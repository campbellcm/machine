import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { defaultProfile, defaultStrategy } from "../content-engine/domain";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  outsider = "33333333-3333-4333-8333-333333333333";
let org: string, source: string, atom: string, idea: string, draft: string;
async function as(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function service() {
  await db.exec("reset role;set role service_role");
}
async function value<T = unknown>(sql: string, args: unknown[] = []) {
  const r = await db.query<Record<string, T>>(sql, args);
  return Object.values(r.rows[0] || {})[0];
}
async function command(operation: string, input: Record<string, unknown> = {}) {
  return value<{ id: string; body?: string }>(
    "select ce_command($1,$2,$3::jsonb)",
    [org, operation, JSON.stringify(input)],
  );
}
async function claim(id: string) {
  await service();
  return value<{ job: { id: string; lease: string }; evidence: unknown[] }>(
    "select ce_claim($1)",
    [id],
  );
}
async function finish(
  job: { job: { id: string; lease: string } },
  result: unknown,
) {
  return value("select ce_finish($1,$2,$3::jsonb,$4::jsonb)", [
    job.job.id,
    job.job.lease,
    JSON.stringify(result),
    JSON.stringify({
      model: "test-model",
      input_tokens: 10,
      output_tokens: 20,
    }),
  ]);
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
  org = await value<string>(
    "select create_organization('Acme','','America/New_York')",
  );
  await db.exec("reset role");
  await db.query(
    "insert into memberships(organization_id,user_id,role,opted_in_at,display_name) values($1,$2,'teammate',now(),'Member')",
    [org, member],
  );
  await as(owner);
  await command("strategy", {
    config: { ...defaultStrategy, enabled: true, review: false },
  });
  await command("profile", { config: defaultProfile, consent: true, step: 6 });
  await as(member);
  await command("profile", { config: defaultProfile, consent: true, step: 6 });
}, 30000);
afterAll(() => db.close());
describe("Content engine permissions and workflow", () => {
  it("requires explicit consent and keeps private sources private", async () => {
    await expect(
      command("source", {
        title: "Private source",
        text: "The team has learned to document ownership before handoffs.",
        visibility: "private",
        roles: [],
        external_use: "approved_fact",
      }),
    ).rejects.toThrow(/Opt in/);
    source = (
      await command("source", {
        title: "Private source",
        text: "The team has learned to document ownership before handoffs.",
        visibility: "private",
        roles: [],
        external_use: "approved_fact",
        consent: true,
      })
    ).id;
    expect(await value("select count(*)::int from ce_sources")).toBe(1);
    await as(owner);
    expect(await value("select count(*)::int from ce_sources")).toBe(0);
  });
  it("extracts exact evidence, creates opportunities and three unapproved drafts atomically", async () => {
    await service();
    const id = await value<string>(
      "select id from ce_jobs where target_id=$1",
      [source],
    );
    const extraction = await claim(id);
    expect(extraction).toBeTruthy();
    expect(await value("select ce_claim($1)", [id])).toBeNull();
    await finish(extraction, {
      atoms: [
        {
          type: "lesson",
          summary: "Document ownership before handoffs",
          excerpt: "document ownership before handoffs",
          topics: ["Product positioning"],
          roles: [],
          confidence: 0.9,
        },
      ],
    });
    expect(await finish(extraction, { atoms: [] })).toBe(false);
    atom = await value<string>("select id from ce_atoms where source_id=$1", [
      source,
    ]);
    await as(member);
    const ideas = await command("ideas");
    const ideaJob = await claim(ideas.id);
    await finish(ideaJob, {
      opportunities: [
        {
          atom_id: atom,
          title: "Make ownership explicit",
          rationale: "Relevant to your role",
          scores: { overall: 90 },
        },
      ],
    });
    idea = await value<string>(
      "select id from ce_opportunities where atom_id=$1",
      [atom],
    );
    await as(member);
    const key = crypto.randomUUID();
    const generated = await command("generate", { id: idea, key });
    expect((await command("generate", { id: idea, key })).id).toBe(
      generated.id,
    );
    const job = await claim(generated.id);
    await finish(job, {
      platform: "linkedin",
      topic: "Ownership",
      variants: [1, 2, 3].map((n) => ({
        body: `I work at Acme. Document ownership before handoffs. Option ${n}.`,
        riskFlags: [],
        sourceIds: [source],
        atomIds: [atom],
      })),
    });
    expect(await value("select count(*)::int from ce_draft_meta")).toBe(3);
    expect(
      await value("select count(*)::int from drafts where status='approved'"),
    ).toBe(0);
    draft = await value<string>("select draft_id from ce_draft_meta limit 1");
  });
  it("isolates every new table, denies forged writes and hides private context in reporting", async () => {
    const tables = [
      "ce_settings",
      "ce_profiles",
      "ce_sources",
      "ce_atoms",
      "ce_opportunities",
      "ce_jobs",
      "ce_draft_meta",
      "ce_versions",
      "ce_events",
      "ce_metrics",
    ];
    await as(outsider);
    for (const table of tables) {
      expect(await value(`select count(*)::int from ${table}`), table).toBe(0);
      await expect(db.query(`delete from ${table}`)).rejects.toThrow(
        /permission denied/,
      );
    }
    await expect(command("ideas")).rejects.toThrow(/Membership/);
    await expect(db.query("select ce_claim($1)", [draft])).rejects.toThrow(
      /permission denied/,
    );
    await as(owner);
    expect(await value("select count(*)::int from ce_draft_meta")).toBe(0);
    expect(await value("select count(*)::int from ce_versions")).toBe(0);
    const report = await value("select ce_admin_report($1)", [org]);
    expect(JSON.stringify(report)).not.toContain("Document ownership");
  });
  it("learns preferences using the same evidence topic used for ranking", async () => {
    await as(member);
    await command("more", { id: draft, revision: 1 });
    expect(
      await value(
        "select preferences->>'Make ownership explicit' from ce_profiles where user_id=$1",
        [member],
      ),
    ).toBe("1");
  });
  it("requires explicit review, invalidates approval on edit, and exports the approved revision", async () => {
    await as(member);
    await expect(
      command("approve", { id: draft, revision: 1 }),
    ).rejects.toThrow(/Review/);
    await command("approve", { id: draft, revision: 1, confirmed: true });
    expect(
      (await command("export", { id: draft, revision: 1 })).body,
    ).toContain("I work at Acme.");
    await command("edit", {
      id: draft,
      revision: 1,
      body: "I work at Acme. Updated lesson about project ownership.",
    });
    await expect(command("export", { id: draft, revision: 2 })).rejects.toThrow(
      /Approve/,
    );
    await expect(
      command("approve", { id: draft, revision: 1, confirmed: true }),
    ).rejects.toThrow(/Draft changed/);
    expect(
      await value("select count(*)::int from ce_versions where draft_id=$1", [
        draft,
      ]),
    ).toBe(2);
  });
  it("runs company review without letting an admin approve for the author", async () => {
    await as(owner);
    await command("strategy", {
      config: { ...defaultStrategy, enabled: true, review: true },
    });
    await as(member);
    await command("approve", { id: draft, revision: 2, confirmed: true });
    await as(owner);
    expect(await value("select count(*)::int from ce_draft_meta")).toBe(1);
    await expect(
      command("approve", { id: draft, revision: 2, confirmed: true }),
    ).rejects.toThrow(/Author/);
    await command("review", { id: draft, revision: 2 });
    await as(member);
    await command("approve", { id: draft, revision: 2, confirmed: true });
    await expect(
      command("published", { id: draft, revision: 2, confirmed: true }),
    ).rejects.toThrow(/valid/);
    await command("published", {
      id: draft,
      revision: 2,
      confirmed: true,
      url: "https://www.linkedin.com/posts/example-123",
    });
    await expect(
      command("edit", {
        id: draft,
        revision: 2,
        body: "I work at Acme. A rewrite.",
      }),
    ).rejects.toThrow(/Immutable/);
    await command("metrics", {
      id: draft,
      revision: 2,
      metrics: { impressions: 100 },
    });
    expect(await value("select count(*)::int from ce_metrics")).toBe(1);
  });
  it("does not grant source access when employees change their own role", async () => {
    await as(owner);
    const shared = await command("source", {
      title: "Restricted context",
      text: "This approved context is restricted to selected enrolled teammates.",
      visibility: "organization",
      roles: ["Engineering"],
      allowed_users: [owner],
      external_use: "internal_only",
      consent: true,
    });
    await as(member);
    await command("profile", {
      config: { ...defaultProfile, role: "Engineering" },
      consent: true,
      step: 6,
    });
    expect(
      await value("select count(*)::int from ce_sources where id=$1", [
        shared.id,
      ]),
    ).toBe(0);
  });
  it("rejects exports after legacy company controls revoke approval", async () => {
    await as(member);
    const other = await value<string>(
      "select draft_id from ce_draft_meta where state='ready_for_employee' limit 1",
    );
    await command("approve", { id: other, revision: 1, confirmed: true });
    await as(owner);
    await command("review", { id: other, revision: 1 });
    await as(member);
    await command("approve", { id: other, revision: 1, confirmed: true });
    await db.exec("reset role");
    await db.query(
      "update drafts set status='draft',approved_revision=null where id=$1",
      [other],
    );
    await as(member);
    await expect(command("export", { id: other, revision: 1 })).rejects.toThrow(
      /Approve/,
    );
  });
  it("cancels in-flight work on pause and invalidates drafts on source removal", async () => {
    await as(member);
    const id = (
      await command("generate", { id: idea, key: crypto.randomUUID() })
    ).id;
    const job = await claim(id);
    await as(member);
    await command("pause");
    await service();
    expect(await finish(job, { variants: [] })).toBe(false);
    await as(member);
    await command("delete_source", { id: source });
    expect(await value("select bool_and(invalidated) from ce_draft_meta")).toBe(
      true,
    );
    expect(await value("select count(*)::int from ce_atoms")).toBe(0);
    await expect(command("delete_profile")).rejects.toThrow(/Confirmation/);
  });
});
