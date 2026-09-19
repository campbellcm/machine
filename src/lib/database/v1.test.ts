import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
let org: string, schedule: string;
async function as(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function scalar<T>(sql: string, args: unknown[] = []) {
  const r = await db.query<Record<string, T>>(sql, args);
  return Object.values(r.rows[0] || {})[0];
}
beforeAll(async () => {
  await db.exec(
    `create role authenticated;create role anon;create role service_role bypassrls;alter default privileges in schema public grant all on tables to anon,authenticated;alter default privileges in schema public grant all on functions to anon,authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users values($1,$2),($3,$4),($5,$6)", [
    owner,
    "o@example.com",
    member,
    "m@example.com",
    outsider,
    "x@example.com",
  ]);
  await as(owner);
  org = await scalar<string>(
    "select create_organization('Acme','','America/New_York')",
  );
  await db.exec("reset role");
  await db.query(
    "insert into memberships(organization_id,user_id,role,opted_in_at,display_name,job_title) values($1,$2,'teammate',now(),'Member','Designer')",
    [org, member],
  );
  await as(member);
  schedule = await scalar<string>(
    "select save_daily_schedule($1,'openai','linkedin','America/New_York',9,'Public context for the company',true)",
    [org],
  );
}, 30000);
afterAll(() => db.close());
describe("Team profile photos", () => {
  it("allows own HTTPS photo updates, shares with colleagues, and denies outsiders", async () => {
    await as(member);
    await db.query(
      "select save_profile_photo($1,'https://example.com/member.jpg')",
      [org],
    );
    await expect(
      db.query("select save_profile_photo($1,'javascript:alert(1)')", [org]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select save_profile_with_photo($1,'Changed','Designer','',array['one','two','three'],true,'http://invalid.test/photo.jpg')",
        [org],
      ),
    ).rejects.toThrow();
    expect(
      await scalar("select display_name from memberships where user_id=$1", [
        member,
      ]),
    ).toBe("Member");
    await as(owner);
    const photos = await db.query<{ user_id: string; photo_url: string }>(
      "select * from team_photos($1)",
      [org],
    );
    expect(photos.rows.find((p) => p.user_id === member)?.photo_url).toBe(
      "https://example.com/member.jpg",
    );
    await db.query("select save_profile_photo($1,'')", [org]);
    expect(
      await scalar("select photo_url from memberships where user_id=$1", [
        member,
      ]),
    ).toBe("https://example.com/member.jpg");
    await as(outsider);
    await expect(
      db.query("select * from team_photos($1)", [org]),
    ).rejects.toThrow(/Membership required/);
    await expect(
      db.query("select save_profile_photo($1,'https://example.com/x.jpg')", [
        org,
      ]),
    ).rejects.toThrow(/Membership required/);
  });
});
describe("V1 private schedules and atomic daily jobs", () => {
  it("hides schedule context and run ledgers from admins and outsiders, and rejects forged writes", async () => {
    for (const id of [owner, outsider]) {
      await as(id);
      expect(
        (await db.query("select * from daily_schedules")).rows,
      ).toHaveLength(0);
      expect((await db.query("select * from daily_runs")).rows).toHaveLength(0);
      await expect(
        db.query("update daily_schedules set enabled=true"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select claim_daily_run($1)", [schedule]),
      ).rejects.toThrow(/permission denied/);
    }
    await as(outsider);
    await expect(
      db.query(
        "select save_daily_schedule($1,'openai','x','UTC',9,'Public context for the company',true)",
        [org],
      ),
    ).rejects.toThrow();
  });
  it("claims once, saves three unapproved drafts atomically, and prevents repeat daily batches", async () => {
    await as(member);
    await db.query("select control_daily_schedule($1,'run')", [org]);
    await db.exec("reset role;set role service_role");
    const job = await scalar<{ run_id: string; lease: string }>(
      "select claim_daily_run($1)",
      [schedule],
    );
    expect(job).toBeTruthy();
    expect(await scalar("select claim_daily_run($1)", [schedule])).toBeNull();
    const items = [1, 2, 3].map((n) => ({
      body: `I work at Acme. Idea ${n}`,
      claims_to_verify: [],
    }));
    expect(
      await scalar("select finish_daily_run($1,$2,$3::jsonb)", [
        job.run_id,
        job.lease,
        JSON.stringify(items),
      ]),
    ).toBe(true);
    expect(
      await scalar("select finish_daily_run($1,$2,$3::jsonb)", [
        job.run_id,
        job.lease,
        JSON.stringify(items),
      ]),
    ).toBe(false);
    await as(member);
    const drafts = (
      await db.query<{ status: string; approved_revision: number | null }>(
        "select status,approved_revision from drafts where daily_run_id=$1",
        [job.run_id],
      )
    ).rows;
    expect(drafts).toHaveLength(3);
    expect(
      drafts.every((d) => d.status === "draft" && d.approved_revision === null),
    ).toBe(true);
    await db.query("select control_daily_schedule($1,'run')", [org]);
    await db.exec("reset role;set role service_role");
    expect(await scalar("select claim_daily_run($1)", [schedule])).toBeNull();
    expect(
      await scalar<boolean>(
        "select next_run_at>now() from daily_schedules where id=$1",
        [schedule],
      ),
    ).toBe(true);
  });
  it("cancels in-flight generation after pause and caps retries", async () => {
    await db.exec("reset role");
    await db.query("delete from daily_runs");
    await as(member);
    await db.query("select control_daily_schedule($1,'run')", [org]);
    await db.exec("reset role;set role service_role");
    const job = await scalar<{ run_id: string; lease: string }>(
      "select claim_daily_run($1)",
      [schedule],
    );
    await as(member);
    await db.query("select control_daily_schedule($1,'pause')", [org]);
    await db.exec("reset role;set role service_role");
    expect(
      await scalar("select finish_daily_run($1,$2,$3::jsonb)", [
        job.run_id,
        job.lease,
        JSON.stringify(
          [1, 2, 3].map((n) => ({
            body: `I work at Acme. Paused ${n}`,
            claims_to_verify: [],
          })),
        ),
      ]),
    ).toBe(false);
    expect(
      await scalar("select status from daily_runs where id=$1", [job.run_id]),
    ).toBe("canceled");
    for (let i = 0; i < 2; i++) {
      await as(member);
      await db.query("select control_daily_schedule($1,'run')", [org]);
      await db.exec("reset role;set role service_role");
      const retry = await scalar<{ run_id: string; lease: string }>(
        "select claim_daily_run($1)",
        [schedule],
      );
      expect(retry).toBeTruthy();
      await db.query(
        "select finish_daily_run($1,$2,'[]'::jsonb,'generation_failed')",
        [retry.run_id, retry.lease],
      );
    }
    await as(member);
    await db.query("select control_daily_schedule($1,'run')", [org]);
    await db.exec("reset role;set role service_role");
    expect(await scalar("select claim_daily_run($1)", [schedule])).toBeNull();
  });
  it("recovers abandoned leases and rejects stale completion tokens", async () => {
    await db.exec("reset role");
    await db.query("delete from daily_runs");
    await as(member);
    await db.query("select control_daily_schedule($1,'run')", [org]);
    await db.exec("reset role;set role service_role");
    const first = await scalar<{ run_id: string; lease: string }>(
      "select claim_daily_run($1)",
      [schedule],
    );
    await db.query(
      "update daily_runs set started_at=now()-interval '6 minutes' where id=$1",
      [first.run_id],
    );
    await db.query(
      "update daily_schedules set next_run_at=now()-interval '1 minute' where id=$1",
      [schedule],
    );
    const second = await scalar<{ run_id: string; lease: string }>(
      "select claim_daily_run($1)",
      [schedule],
    );
    expect(second.run_id).toBe(first.run_id);
    expect(second.lease).not.toBe(first.lease);
    expect(
      await scalar(
        "select finish_daily_run($1,$2,'[]'::jsonb,'generation_failed')",
        [first.run_id, first.lease],
      ),
    ).toBe(false);
    await db.query(
      "select finish_daily_run($1,$2,'[]'::jsonb,'generation_failed')",
      [second.run_id, second.lease],
    );
    expect(
      await scalar<boolean>(
        "select next_run_at between now() and now()+interval '16 minutes' from daily_schedules where id=$1",
        [schedule],
      ),
    ).toBe(true);
  });
  it("exposes safe team metadata and no private drafts through reporting", async () => {
    await as(member);
    expect(
      (await db.query("select * from team_connections($1)", [org])).rows.length,
    ).toBe(2);
    const report = await scalar<{ posts: unknown[] }>(
      "select home_report($1,current_date,current_date)",
      [org],
    );
    expect(report.posts).toHaveLength(0);
    await expect(db.query("select * from social_accounts")).rejects.toThrow(
      /permission denied/,
    );
    await as(outsider);
    await expect(
      db.query("select * from team_connections($1)", [org]),
    ).rejects.toThrow();
    await expect(
      db.query("select home_report($1,current_date,current_date)", [org]),
    ).rejects.toThrow();
  });
  it("allows only admins to create prizes and never marks an unfinished prize fulfilled", async () => {
    await as(member);
    await expect(
      db.query(
        "select create_reward($1,'Prize','Mac mini','Rules','unique_clicks',now()+interval '1 day',now()+interval '2 days')",
        [org],
      ),
    ).rejects.toThrow();
    await as(owner);
    const reward = await scalar<string>(
      "select create_reward($1,'Prize','Mac mini','Rules','unique_clicks',now()+interval '1 day',now()+interval '2 days')",
      [org],
    );
    await expect(
      db.query("select fulfill_reward($1)", [reward]),
    ).rejects.toThrow();
    await as(outsider);
    expect(
      (await db.query("select * from challenges where id=$1", [reward])).rows,
    ).toHaveLength(0);
  });
  it("enforces X channel and length at publication boundaries", async () => {
    await as(member);
    const id = await scalar<string>(
      "select save_channel_draft($1,null,'I work at Acme. Short X idea',null,'x')",
      [org],
    );
    await db.query("select transition_draft($1,1,'approve')", [id]);
    await expect(
      db.query("select claim_channel_publish($1,1,'linkedin')", [id]),
    ).rejects.toThrow(/Channel mismatch/);
    await expect(
      db.query("select schedule_post($1,1,now()+interval '1 hour')", [id]),
    ).rejects.toThrow();
    await expect(
      db.query(
        "select record_manual_post($1,1,'https://www.linkedin.com/feed/update/urn:li:share:123/')",
        [id],
      ),
    ).rejects.toThrow(/X URL required/);
    await db.query("select record_x_post($1,1,'https://x.com/i/status/123')", [
      id,
    ]);
    expect(await scalar("select status from drafts where id=$1", [id])).toBe(
      "published",
    );
  });
});

describe("Connection renewal and safe health", () => {
  async function store() {
    await db.exec("reset role;set role service_role");
    await db.query(
      "select store_channel_connection($1,$2,'x','998877','@member','access-v1','refresh-v1',now()+interval '10 minutes')",
      [org, member],
    );
  }
  it("keeps credentials and rotation RPCs inaccessible to teammates and admins", async () => {
    await store();
    for (const id of [member, owner, outsider]) {
      await as(id);
      await expect(
        db.query("select refresh_token_encrypted from social_accounts"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select claim_connection_token($1,$2,'x')", [org, member]),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      db.query("select * from team_connection_health($1)", [org]),
    ).rejects.toThrow(/Membership required/);
    await as(owner);
    const rows = (
      await db.query<Record<string, unknown>>(
        "select * from team_connection_health($1)",
        [org],
      )
    ).rows;
    expect(rows[0].state).toBe("connected");
    expect(rows[0]).not.toHaveProperty("refresh_token_encrypted");
  });
  it("does not allow another member to connect an owned social profile", async () => {
    await store();
    await db.exec("reset role");
    await db.query(
      "update memberships set opted_in_at=now() where organization_id=$1 and user_id=$2",
      [org, owner],
    );
    await db.exec("set role service_role");
    await expect(
      db.query(
        "select store_channel_connection($1,$2,'x','998877','Other','access',null,now()+interval '2 hours')",
        [org, owner],
      ),
    ).rejects.toThrow(/Profile belongs/);
    await db.query(
      "select store_channel_connection($1,$2,'linkedin','linked-owner','Member','access',null,now()+interval '2 hours')",
      [org, member],
    );
    await expect(
      db.query(
        "select store_social_account($1,$2,'linked-owner','Other','access',now()+interval '2 hours')",
        [org, owner],
      ),
    ).rejects.toThrow(/Profile belongs/);
  });
  it("only releases a matching in-flight revision after definitive rejection", async () => {
    await as(member);
    const id = await scalar<string>(
      "select save_channel_draft($1,null,'I work at Acme. A retry test',null,'x')",
      [org],
    );
    await db.query("select transition_draft($1,1,'approve')", [id]);
    await db.query("select claim_channel_publish($1,1,'x')", [id]);
    await expect(
      db.query("select reject_publish_attempt($1,1)", [id]),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role;set role service_role");
    expect(await scalar("select reject_publish_attempt($1,2)", [id])).toBe(
      false,
    );
    expect(await scalar("select reject_publish_attempt($1,1)", [id])).toBe(
      true,
    );
    expect(await scalar("select reject_publish_attempt($1,1)", [id])).toBe(
      false,
    );
    await as(member);
    expect(await scalar("select claim_channel_publish($1,1,'x')", [id])).toBe(
      "I work at Acme. A retry test",
    );
  });
  it("serializes rotation and prevents a disconnected account from being resurrected", async () => {
    await store();
    const claim = await scalar<{ kind: string; lease: string }>(
      "select claim_connection_token($1,$2,'x')",
      [org, member],
    );
    expect(claim.kind).toBe("refresh");
    expect(
      await scalar("select claim_connection_token($1,$2,'x')", [org, member]),
    ).toEqual({ kind: "busy" });
    await as(member);
    await db.query("select disconnect_channel($1,'x')", [org]);
    await db.exec("reset role;set role service_role");
    expect(
      await scalar(
        "select finish_connection_refresh($1,$2,'x',$3,'new','new-refresh',now()+interval '2 hours')",
        [org, member, claim.lease],
      ),
    ).toBe(false);
    expect(
      await scalar("select claim_connection_token($1,$2,'x')", [org, member]),
    ).toEqual({ kind: "reconnect" });
  });
  it("rejects stale rotations after reconnect and preserves newly verified account health", async () => {
    await store();
    const claim = await scalar<{ lease: string }>(
      "select claim_connection_token($1,$2,'x')",
      [org, member],
    );
    await db.query(
      "select store_channel_connection($1,$2,'x','998877','@member','replacement','replacement-refresh',now()+interval '2 hours')",
      [org, member],
    );
    expect(
      await scalar(
        "select finish_connection_refresh($1,$2,'x',$3,'stale','stale-refresh',now()+interval '2 hours')",
        [org, member, claim.lease],
      ),
    ).toBe(false);
    await db.query(
      "select record_connection_check($1,$2,'x','access-v1','reconnect')",
      [org, member],
    );
    expect(
      await scalar("select claim_connection_token($1,$2,'x')", [org, member]),
    ).toMatchObject({ kind: "ready", encrypted: "replacement" });
  });
  it("does not replay timed-out rotations, and rotates credentials only once", async () => {
    await store();
    const claim = await scalar<{ lease: string }>(
      "select claim_connection_token($1,$2,'x')",
      [org, member],
    );
    expect(
      await scalar(
        "select finish_connection_refresh($1,$2,'x',$3,'new','rotated',now()+interval '2 hours')",
        [org, member, claim.lease],
      ),
    ).toBe(true);
    expect(
      await scalar(
        "select finish_connection_refresh($1,$2,'x',$3,'new','rotated',now()+interval '2 hours')",
        [org, member, claim.lease],
      ),
    ).toBe(false);
    await store();
    await db.query("select claim_connection_token($1,$2,'x')", [org, member]);
    await db.exec("reset role");
    await db.query(
      "update social_accounts set refresh_started_at=now()-interval '3 minutes' where organization_id=$1 and user_id=$2 and provider='x'",
      [org, member],
    );
    await db.exec("set role service_role");
    expect(
      await scalar("select claim_connection_token($1,$2,'x')", [org, member]),
    ).toEqual({ kind: "reconnect" });
    await as(member);
    await db.query("select disconnect_channel($1,'x')", [org]);
  });
});

describe("Private imports and opt-in participation", () => {
  const batch = [
    {
      id: "445566",
      author_id: "998877",
      text: "Approved work insight",
      created_at: "2026-09-18T12:00:00Z",
      public_metrics: { impression_count: 100, like_count: 3 },
    },
  ];
  let post: string;
  it("requires opt-in and keeps unselected imports private from admins", async () => {
    await db.exec("reset role;set role service_role");
    await db.query(
      "select store_channel_connection($1,$2,'x','998877','Member','access','refresh',now()+interval '2 hours')",
      [org, member],
    );
    expect(
      await scalar("select save_tracked_posts($1,$2,'x','998877',$3)", [
        org,
        member,
        JSON.stringify(batch),
      ]),
    ).toBe(false);
    await as(member);
    await db.query("select set_post_tracking($1,'x',true)", [org]);
    await db.exec("reset role;set role service_role");
    expect(
      await scalar("select save_tracked_posts($1,$2,'x','998877',$3)", [
        org,
        member,
        JSON.stringify(batch),
      ]),
    ).toBe(true);
    post = await scalar<string>(
      "select id from tracked_posts where provider_post_id='445566'",
    );
    await as(owner);
    expect((await db.query("select * from tracked_posts")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from post_snapshots")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query("select select_work_post($1,true)", [post]),
    ).rejects.toThrow(/Author required/);
    await as(member);
    await db.query("select select_work_post($1,true)", [post]);
    await as(owner);
    expect((await db.query("select * from tracked_posts")).rows).toHaveLength(
      1,
    );
    expect((await db.query("select * from post_snapshots")).rows).toHaveLength(
      1,
    );
    await as(outsider);
    expect((await db.query("select * from tracked_posts")).rows).toHaveLength(
      0,
    );
    expect((await db.query("select * from post_snapshots")).rows).toHaveLength(
      0,
    );
  });
  it("deduplicates imported publication counts against the complete stored draft history", async () => {
    await as(member);
    expect(
      (
        await db.query<{ posts: number }>(
          "select * from imported_post_counts($1,'2026-09-01','2026-09-30')",
          [org],
        )
      ).rows[0].posts,
    ).toBe(1);
    const id = await scalar<string>(
      "select save_channel_draft($1,null,'I work at Acme. Tracking dedupe test',null,'x')",
      [org],
    );
    await db.query("select transition_draft($1,1,'approve')", [id]);
    await db.query("select claim_channel_publish($1,1,'x')", [id]);
    await db.exec("reset role;set role service_role");
    await db.query("select complete_x_publish($1,'445566')", [id]);
    await as(member);
    expect(
      (
        await db.query(
          "select * from imported_post_counts($1,'2026-09-01','2026-09-30')",
          [org],
        )
      ).rows,
    ).toHaveLength(0);
    await as(outsider);
    await expect(
      db.query(
        "select * from imported_post_counts($1,'2026-09-01','2026-09-30')",
        [org],
      ),
    ).rejects.toThrow(/Membership/);
  });
  it("rejects wrong-author data, duplicate post rows and sync after disconnect", async () => {
    await db.exec("reset role;set role service_role");
    await expect(
      db.query("select save_tracked_posts($1,$2,'x','998877',$3)", [
        org,
        member,
        JSON.stringify([{ ...batch[0], author_id: "other" }]),
      ]),
    ).rejects.toThrow(/Invalid post/);
    await db.query("select save_tracked_posts($1,$2,'x','998877',$3)", [
      org,
      member,
      JSON.stringify(batch),
    ]);
    expect(await scalar("select count(*)::int from tracked_posts")).toBe(1);
    await as(member);
    await db.query("select disconnect_channel($1,'x')", [org]);
    await db.exec("reset role;set role service_role");
    expect(
      await scalar("select save_tracked_posts($1,$2,'x','998877',$3)", [
        org,
        member,
        JSON.stringify(batch),
      ]),
    ).toBe(false);
    await as(member);
    await db.query("select select_work_post($1,false)", [post]);
    await as(owner);
    expect((await db.query("select * from post_snapshots")).rows).toHaveLength(
      0,
    );
  });
});

describe("Author-controlled X schedules", () => {
  it("requires the correct channel connection and preserves approval until the due claim", async () => {
    await as(member);
    const id = await scalar<string>(
      "select save_channel_draft($1,null,'I work at Acme. Scheduled X post',null,'x')",
      [org],
    );
    await db.query("select transition_draft($1,1,'approve')", [id]);
    await expect(
      db.query("select schedule_post($1,1,now()+interval '1 hour')", [id]),
    ).rejects.toThrow(/Reconnect/);
    await db.exec("reset role;set role service_role");
    await db.query(
      "select store_channel_connection($1,$2,'x','998877','Member','access','refresh',now()+interval '2 hours')",
      [org, member],
    );
    await as(owner);
    await expect(
      db.query("select schedule_post($1,1,now()+interval '1 hour')", [id]),
    ).rejects.toThrow(/author approval/);
    await as(member);
    await db.query("select schedule_post($1,1,now()+interval '3 hours')", [id]);
    expect(await scalar("select status from drafts where id=$1", [id])).toBe(
      "approved",
    );
    await db.exec("reset role");
    await db.query(
      "update publish_jobs set run_at=now()-interval '1 minute' where draft_id=$1",
      [id],
    );
    const job = await scalar<string>(
      "select id from publish_jobs where draft_id=$1",
      [id],
    );
    await db.exec("set role service_role");
    expect(
      await scalar("select claim_scheduled_post($1)", [job]),
    ).toMatchObject({
      channel: "x",
      revision: 1,
      body: "I work at Acme. Scheduled X post",
    });
    expect(await scalar("select claim_scheduled_post($1)", [job])).toBeNull();
    await db.query("select complete_x_publish($1,'787878')", [id]);
  });
});

describe("Inclusive reward scoring", () => {
  it("does not penalize extra same-day posts in consistency ties", async () => {
    await db.exec("begin");
    try {
      await db.exec("reset role");
      await db.query("delete from drafts where organization_id=$1", [org]);
      await db.query("delete from tracked_posts where organization_id=$1", [
        org,
      ]);
      for (const [person, hour] of [
        [member, 10],
        [owner, 11],
        [member, 12],
      ] as const) {
        await db.query(
          "insert into drafts(organization_id,user_id,body,status,verified,published_at) values($1,$2,'I work at Acme. Public lesson.','published',true,date_trunc('day',now())-interval '2 days'+make_interval(hours=>$3))",
          [org, person, hour],
        );
      }
      await as(owner);
      const id = await scalar<string>(
        "select create_reward_v2($1,'Consistency','Prize','Rules','active_days',now()+interval '1 day',now()+interval '8 days',null)",
        [org],
      );
      await db.exec("reset role");
      await db.query(
        "update challenges set starts_at=now()-interval '7 days',ends_at=now(),settling_hours=0 where id=$1",
        [id],
      );
      await as(member);
      const scores = (
        await db.query<{ user_id: string; score: number }>(
          "select * from challenge_scores($1)",
          [id],
        )
      ).rows;
      expect(scores[0].user_id).toBe(member);
      expect(scores.map((s) => Number(s.score))).toEqual([1, 1]);
      await db.exec("set role service_role");
      await db.query("select advance_challenges()");
      expect(
        await scalar(
          "select user_id from challenge_results where challenge_id=$1 and is_winner",
          [id],
        ),
      ).toBe(member);
    } finally {
      await db.exec("rollback");
    }
  });

  it("counts days, absolute improvement and shared goals with immutable settlement", async () => {
    await db.exec("begin");
    try {
      await db.exec("reset role");
      await db.query("delete from drafts where organization_id=$1", [org]);
      await db.query("delete from tracked_posts where organization_id=$1", [
        org,
      ]);
      for (const [person, day] of [
        [member, 1],
        [member, 1],
        [member, 2],
        [member, 8],
        [owner, 2],
      ] as const) {
        await db.query(
          "insert into drafts(organization_id,user_id,body,status,verified,published_at) values($1,$2,'I work at Acme. Public lesson.','published',true,now()-make_interval(days=>$3))",
          [org, person, day],
        );
      }
      await as(owner);
      const ids: Record<string, string> = {};
      for (const metric of [
        "active_days",
        "improvement_posts",
        "first_post",
        "team_posts",
      ]) {
        ids[metric] = await scalar<string>(
          "select create_reward_v2($1,'Challenge','Company prize','Rules',$2,now()+interval '1 day',now()+interval '8 days',3)",
          [org, metric],
        );
      }
      await db.exec("reset role");
      await db.query(
        "update challenges set starts_at=now()-interval '7 days',ends_at=now(),settling_hours=0 where id=any($1::uuid[])",
        [Object.values(ids)],
      );
      await as(member);
      const scores = async (metric: string) =>
        (
          await db.query<{ user_id: string; score: number }>(
            "select * from challenge_scores($1)",
            [ids[metric]],
          )
        ).rows;
      expect(
        Number(
          (await scores("active_days")).find((p) => p.user_id === member)
            ?.score,
        ),
      ).toBe(2);
      expect(
        Number(
          (await scores("improvement_posts")).find((p) => p.user_id === member)
            ?.score,
        ),
      ).toBe(2);
      expect(
        Number(
          (await scores("first_post")).find((p) => p.user_id === member)?.score,
        ),
      ).toBe(0);
      expect(
        Number(
          (await scores("first_post")).find((p) => p.user_id === owner)?.score,
        ),
      ).toBe(1);
      await db.exec("set role service_role");
      await db.query("select advance_challenges()");
      expect(
        await scalar(
          "select count(*)::int from challenge_results where challenge_id=$1 and is_winner",
          [ids.team_posts],
        ),
      ).toBe(2);
      await db.query("select advance_challenges()");
      expect(
        await scalar(
          "select count(*)::int from challenge_results where challenge_id=$1",
          [ids.team_posts],
        ),
      ).toBe(2);
    } finally {
      await db.exec("rollback");
    }
  });
  it("denies direct internal scoring and requires a shared goal", async () => {
    await as(member);
    await expect(
      db.query("select * from reward_scores_internal(gen_random_uuid())"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query(
        "select create_reward_v2($1,'Challenge','Prize','Rules','active_days',now()+interval '1 day',now()+interval '8 days',null)",
        [org],
      ),
    ).rejects.toThrow(/Admin/);
    await as(owner);
    await expect(
      db.query(
        "select create_reward_v2($1,'Challenge','Prize','Rules','team_posts',now()+interval '1 day',now()+interval '8 days',null)",
        [org],
      ),
    ).rejects.toThrow(/target/);
  });
});
