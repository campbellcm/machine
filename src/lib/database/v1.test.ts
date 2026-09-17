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
    await db.query("select save_profile_photo($1,'https://example.com/member.jpg')", [org]);
    await expect(db.query("select save_profile_photo($1,'javascript:alert(1)')", [org])).rejects.toThrow();
    await expect(db.query("select save_profile_with_photo($1,'Changed','Designer','',array['one','two','three'],true,'http://invalid.test/photo.jpg')", [org])).rejects.toThrow();
    expect(await scalar("select display_name from memberships where user_id=$1", [member])).toBe("Member");
    await as(owner);
    const photos = await db.query<{ user_id: string; photo_url: string }>("select * from team_photos($1)", [org]);
    expect(photos.rows.find(p => p.user_id === member)?.photo_url).toBe("https://example.com/member.jpg");
    await db.query("select save_profile_photo($1,'')", [org]);
    expect(await scalar("select photo_url from memberships where user_id=$1", [member])).toBe("https://example.com/member.jpg");
    await as(outsider);
    await expect(db.query("select * from team_photos($1)", [org])).rejects.toThrow(/Membership required/);
    await expect(db.query("select save_profile_photo($1,'https://example.com/x.jpg')", [org])).rejects.toThrow(/Membership required/);
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
