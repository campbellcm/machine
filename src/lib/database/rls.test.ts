import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111",
  teammate = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333",
  viewer = "44444444-4444-4444-8444-444444444444";
let org: string, other: string, draft: string;
async function asUser(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function rpc<T = unknown>(sql: string, params: unknown[] = []) {
  const result = await db.query<Record<string, T>>(sql, params);
  return Object.values(result.rows[0] || {})[0] as T;
}
beforeAll(async () => {
  await db.exec(
    `create role authenticated;create role anon;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant all on functions to anon,authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query(
    "insert into auth.users values ($1,$2),($3,$4),($5,$6),($7,$8)",
    [
      owner,
      "owner@example.com",
      teammate,
      "teammate@example.com",
      outsider,
      "other@example.com",
      viewer,
      "viewer@example.com",
    ],
  );
  await asUser(owner);
  org = await rpc<string>(
    "select create_organization('Acme','https://example.com','America/New_York')",
  );
  await db.query(
    "select save_profile($1,'Owner','Founder','Product',array['a','b','c'],true)",
    [org],
  );
  await asUser(outsider);
  other = await rpc<string>(
    "select create_organization('Other','https://other.example','UTC')",
  );
  await db.exec("reset role");
  await db.query(
    "insert into memberships(organization_id,user_id,role,opted_in_at) values($1,$2,'teammate',now()),($1,$3,'viewer',null)",
    [org, teammate, viewer],
  );
  await asUser(teammate);
  draft = await rpc<string>(
    "select save_draft($1,null,'I work at Acme.\nA useful lesson.',null)",
    [org],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("database authorization and publication state machine", () => {
  it("enables RLS for every application table", async () => {
    await db.exec("reset role");
    const rows = (
      await db.query<{ relname: string; relrowsecurity: boolean }>(
        "select relname,relrowsecurity from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r'",
      )
    ).rows;
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  });
  it("isolates company data from another tenant", async () => {
    await asUser(outsider);
    expect(
      (await db.query("select * from organizations where id=$1", [org])).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from memberships where organization_id=$1", [
          org,
        ])
      ).rows,
    ).toHaveLength(0);
    for (const table of [
      "drafts",
      "interviews",
      "campaigns",
      "tracked_links",
      "link_clicks",
      "conversions",
      "audit_log",
    ])
      expect(
        (
          await db.query(`select * from ${table} where organization_id=$1`, [
            org,
          ])
        ).rows,
      ).toHaveLength(0);
    expect(
      (
        await db.query("select id from invitations where organization_id=$1", [
          org,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(other).not.toBe(org);
  });
  it("does not expose token or API key tables even to an owner", async () => {
    await asUser(owner);
    await expect(db.query("select * from social_accounts")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.query("select * from api_keys")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("select token_hash from invitations"),
    ).rejects.toThrow(/permission denied/);
  });
  it("keeps unpublished teammate content private from the admin", async () => {
    await asUser(owner);
    expect(
      (await db.query("select * from drafts where id=$1", [draft])).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select transition_draft($1,1,'approve')", [draft]),
    ).rejects.toThrow(/Author approval/);
  });
  it("rejects direct writes, viewer drafts, cross-tenant writes and opt-out drafts", async () => {
    await asUser(owner);
    await expect(
      db.query("update drafts set status='approved' where id=$1", [draft]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select save_draft($1,null,'wrong org',null)", [other]),
    ).rejects.toThrow(/Opt in/);
    await asUser(viewer);
    await expect(
      db.query("select save_draft($1,null,'no consent',null)", [org]),
    ).rejects.toThrow(/Opt in/);
  });
  it("binds approval to exact revision and does not let a post publish twice", async () => {
    await asUser(teammate);
    await db.query("select transition_draft($1,1,'approve')", [draft]);
    await db.query("select save_draft($1,$2,'I work at Acme.\nChanged.',1)", [
      org,
      draft,
    ]);
    await expect(
      db.query("select claim_publish($1,1)", [draft]),
    ).rejects.toThrow();
    await db.query("select transition_draft($1,2,'approve')", [draft]);
    expect(await rpc("select claim_publish($1,2)", [draft])).toContain(
      "Changed",
    );
    await expect(
      db.query("select claim_publish($1,2)", [draft]),
    ).rejects.toThrow();
    await expect(
      db.query("select complete_publish($1,'urn:li:share:123')", [draft]),
    ).rejects.toThrow(/permission denied/);
  });
  it("requires admin review then a separate author approval", async () => {
    await asUser(owner);
    await db.query(
      "select save_company($1,'context','voice',array['secret'],true)",
      [org],
    );
    await asUser(teammate);
    const id = await rpc<string>(
      "select save_draft($1,null,'I work at Acme.\nPublic lesson.',null)",
      [org],
    );
    await expect(
      db.query("select transition_draft($1,1,'approve')", [id]),
    ).rejects.toThrow(/review first/);
    await db.query("select transition_draft($1,1,'submit')", [id]);
    await asUser(owner);
    expect(
      (await db.query("select id from drafts where id=$1", [id])).rows,
    ).toHaveLength(1);
    await db.query("select transition_draft($1,1,'review')", [id]);
    await expect(
      db.query("select transition_draft($1,1,'approve')", [id]),
    ).rejects.toThrow(/Author approval/);
    await asUser(teammate);
    await db.query("select transition_draft($1,1,'approve')", [id]);
  });
  it("blocks disclosure removal and banned phrases", async () => {
    await asUser(teammate);
    for (const body of [
      "Missing employment disclosure",
      "I work at Acme. A secret",
    ]) {
      const id = await rpc<string>("select save_draft($1,null,$2,null)", [
        org,
        body,
      ]);
      await expect(
        db.query("select transition_draft($1,1,'submit')", [id]),
      ).rejects.toThrow(/disclosure/);
    }
  });
  it("invites bind to email and cannot be reused", async () => {
    await asUser(owner);
    await db.query(
      "select create_invitation($1,'other@example.com','teammate','test-token-hash')",
      [org],
    );
    await asUser(teammate);
    await expect(
      db.query("select accept_invitation('test-token-hash')"),
    ).rejects.toThrow(/unavailable/);
    await asUser(outsider);
    expect(await rpc("select accept_invitation('test-token-hash')")).toBe(org);
    await expect(
      db.query("select accept_invitation('test-token-hash')"),
    ).rejects.toThrow(/unavailable/);
  });
  it("denies anonymous access and service-only functions", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select * from organizations")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("select create_organization('X','','UTC')"),
    ).rejects.toThrow(/permission denied/);
    await asUser(owner);
    for (const call of [
      "select advance_challenges()",
      "select allow_request('bucket',10,60)",
      "select claim_scheduled_post('00000000-0000-4000-8000-000000000000')",
    ]) {
      await expect(db.query(call)).rejects.toThrow(/permission denied/);
    }
  });
  it("deduplicates click events and conversions atomically and keeps other-tenant clicks unattributed", async () => {
    await asUser(owner);
    const campaign = await rpc<string>(
      "select create_campaign($1,'Demo','https://example.com','test')",
      [org],
    );
    const post = await rpc<string>(
      "select save_draft($1,null,'I work at Acme. A lesson.',null)",
      [org],
    );
    await db.query(
      "select attach_link($1,$2,'abc1234','https://app.example',1)",
      [post, campaign],
    );
    const link = await rpc<string>(
      "select id from tracked_links where draft_id=$1",
      [post],
    );
    await db.exec("reset role");
    const c1 = "55555555-5555-4555-8555-555555555555",
      c2 = "66666666-6666-4666-8666-666666666666";
    await db.query("select log_click($1,$2,'visitor',false)", [link, c1]);
    await db.query("select log_click($1,$2,'visitor',false)", [link, c2]);
    expect(
      await rpc<number>(
        "select count(*)::integer from link_clicks where tracked_link_id=$1 and not is_duplicate",
        [link],
      ),
    ).toBe(1);
    expect(
      await rpc("select record_conversion($1,$2,\'lead\',\'event-1\',now())", [
        org,
        c1,
      ]),
    ).toBe(true);
    expect(
      await rpc("select record_conversion($1,$2,\'lead\',\'event-1\',now())", [
        org,
        c1,
      ]),
    ).toBe(false);
    await db.query(
      "select record_conversion($1,$2,'lead','wrong-company',now())",
      [other, c1],
    );
    expect(
      await rpc(
        "select user_id from conversions where external_id=\'wrong-company\'",
      ),
    ).toBe(null);
    await db.query("select record_conversion($1,$2,'lead','repeat-touch',now())",[org,c2]);
    expect(await rpc("select user_id from conversions where external_id='repeat-touch'")).toBe(owner);
    await asUser(viewer);
    expect(
      (
        await db.query("select * from link_clicks where organization_id=$1", [
          org,
        ])
      ).rows,
    ).toHaveLength(2);
    await db.exec("reset role");
    await db.query(
      "insert into auth.users values('77777777-7777-4777-8777-777777777777','stranger@example.com')",
    );
    await asUser("77777777-7777-4777-8777-777777777777");
    for (const table of ["tracked_links", "link_clicks", "conversions"])
      expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
  });
  it("saves only private interviews and commits three generated drafts once", async () => {
    await asUser(teammate);
    const id = await rpc<string>(
      "select save_interview($1,null,'topic','','',0)",
      [org],
    );
    await expect(
      db.query("select claim_generation($1)", [id]),
    ).resolves.toBeDefined();
    expect(await rpc("select claim_generation($1)", [id])).toBe(false);
    for (let n = 0; n < 3; n++)
      await db.query(
        "select save_interview($1,$2,'topic','Question','Public answer',$3)",
        [org, id, n],
      );
    await asUser(owner);
    expect(
      (await db.query("select * from interviews where id=$1", [id])).rows,
    ).toHaveLength(0);
    await asUser(teammate);
    expect(await rpc("select claim_generation($1)", [id])).toBe(true);
    expect(await rpc("select claim_generation($1)", [id])).toBe(false);
    await db.exec("reset role");
    const items = JSON.stringify(
      [1, 2, 3].map((n) => ({
        body: "I work at Acme. Lesson " + n,
        claims_to_verify: ["Confirm lesson"],
      })),
    );
    await db.query("select complete_generation($1,$2)", [id, items]);
    await expect(
      db.query("select complete_generation($1,$2)", [id, items]),
    ).rejects.toThrow(/unavailable/);
  });
  it("invalidates scheduled publishing when text changes", async () => {
    await asUser(owner);
    await db.query("select save_company($1,'','',array[]::text[],false)", [
      org,
    ]);
    const id = await rpc<string>(
      "select save_draft($1,null,'I work at Acme. Scheduled lesson.',null)",
      [org],
    );
    await db.query("select transition_draft($1,1,'approve')", [id]);
    await db.exec("reset role");
    await db.query(
      "select store_social_account($1,$2,'owner-person','Owner','encrypted',now()+interval '30 days')",
      [org, owner],
    );
    await asUser(owner);
    await db.query("select schedule_post($1,1,now()+interval '1 day')", [id]);
    await db.query(
      "select save_draft($1,$2,'I work at Acme. Changed scheduled text.',1)",
      [org, id],
    );
    await db.exec("reset role");
    await db.query(
      "update publish_jobs set run_at=now()-interval '1 minute' where draft_id=$1",
      [id],
    );
    const job = await rpc<string>(
      "select id from publish_jobs where draft_id=$1",
      [id],
    );
    expect(await rpc("select claim_scheduled_post($1)", [job])).toBe(null);
    expect(
      await rpc("select status from publish_jobs where id=$1", [job]),
    ).toBe("canceled");
  });
  it("settles private challenges once and excludes unverified posts", async () => {
    await asUser(owner);
    const id = await rpc<string>(
      "select create_challenge($1,'Recognition','Public posts only','published_posts',now()-interval '10 days',now()-interval '4 days',1)",
      [org],
    );
    await db.exec("reset role");
    await db.query(
      "insert into drafts(organization_id,user_id,body,status,verified,published_at) values($1,$2,'Verified','published',true,now()-interval '5 days'),($1,$2,'No link','published',false,now()-interval '5 days'),($1,$2,'Too late','published',true,now())",
      [org, owner],
    );
    await asUser(owner);
    const scores = (
      await db.query<{ score: number }>(
        "select * from challenge_scores($1) where user_id=$2",
        [id, owner],
      )
    ).rows;
    expect(Number(scores[0].score)).toBe(1);
    await db.exec("reset role");
    expect(await rpc("select advance_challenges()")).toBe(1);
    expect(await rpc("select advance_challenges()")).toBe(0);
    await asUser(owner);
    expect(
      (
        await db.query(
          "select * from challenge_results where challenge_id=$1",
          [id],
        )
      ).rows.length,
    ).toBeGreaterThan(0);
    await asUser("77777777-7777-4777-8777-777777777777");
    expect((await db.query("select * from challenges")).rows).toHaveLength(0);
    expect(
      (await db.query("select * from challenge_results")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select * from challenge_scores($1)", [id]),
    ).rejects.toThrow(/Membership required/);
  });
  it("uses real tables even when a user creates shadowing temporary tables", async () => {
    await asUser(owner);
    await db.exec(
      "create temporary table memberships(organization_id uuid,user_id uuid,role text,removed_at timestamptz)",
    );
    expect(await rpc("select member_role($1)", [other])).toBe(null);
    await db.exec("drop table pg_temp.memberships");
  });
  it("leaving deletes private content and access tokens", async () => {
    await db.exec("reset role");
    await db.query(
      "insert into social_accounts(organization_id,user_id,provider,provider_user_id,display_name,token_encrypted,expires_at) values($1,$2,'linkedin','person','Test','encrypted',now()+interval '1 day')",
      [org, teammate],
    );
    await asUser(teammate);
    await db.query(
      "select save_profile($1,'Test','Role','Team',array['a','b','c'],false)",
      [org],
    );
    await db.exec("reset role");
    expect(
      (
        await db.query("select * from social_accounts where user_id=$1", [
          teammate,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from drafts where user_id=$1", [teammate]))
        .rows,
    ).toHaveLength(0);
  });
});
