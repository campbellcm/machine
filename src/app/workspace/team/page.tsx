import { z } from "zod";
import { TeamAvatar } from "@/components/v1/team-avatar";
import { cookies } from "next/headers";
import Link from "next/link";
import { linkedinConfig } from "@/lib/social/linkedin";
import { xConfig } from "@/lib/social/x";
import { connectionLabel, connectionNotice } from "@/lib/social/health";
import { disconnectChannel, checkConnection } from "@/lib/social/actions";
import { workspace } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { inviteMember, changeMember } from "../actions";
export default async function Team({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; person?: string }>;
}) {
  const { notice, person } = await searchParams;
  const { db, org, member, user } = await workspace();
  const admin = ["owner", "admin"].includes(member.role);
  const { data: connections, error: connectionError } = await db.rpc(
    "team_connections",
    { org: org.id },
  );
  const { data: health, error: healthError } = await db.rpc(
    "team_connection_health",
    { org: org.id },
  );
  const accountHealth = (health || []) as {
    user_id: string;
    provider: string;
    state: string;
    last_verified_at: string | null;
    renewal_enabled: boolean;
  }[];
  const profiles = (connections || []) as {
    user_id: string;
    display_name: string;
    job_title: string;
    linkedin_name: string | null;
    linkedin_expires: string | null;
    x_name: string | null;
    x_expires: string | null;
  }[];
  const { data: team } = await db
    .from("memberships")
    .select("*")
    .eq("organization_id", org.id)
    .is("removed_at", null);
  const { data: photos } = await db.rpc("team_photos", { org: org.id });
  const photoByUser = new Map<string, string>(
    (photos || []).map((p: { user_id: string; photo_url: string }) => [
      p.user_id,
      p.photo_url,
    ]),
  );
  const { data: program, error: programError } = await db.rpc("team_program", {
    org: org.id,
  });
  const progress = (program || []) as {
    id: string;
    participating: boolean;
    voice_ready: boolean | null;
    connected: boolean;
    first_post: boolean;
    posts: number;
    clicks: number;
    leads: number;
  }[];
  const selected = z.uuid().safeParse(person);
  const selectedPerson = selected.success
    ? profiles.find((p) => p.user_id === selected.data)
    : undefined;
  const selectedStats = progress.find((p) => p.id === selectedPerson?.user_id);
  const publicPosts = selectedPerson
    ? await db.rpc("teammate_public_posts", {
        org: org.id,
        person: selectedPerson.user_id,
      })
    : null;
  const posts = (publicPosts?.data || []) as {
    id: string;
    body: string;
    channel: string;
    url: string | null;
    published_at: string;
  }[];
  const token = (await cookies()).get("crewcast_invite")?.value;
  return (
    <div className="v1">
      <p className="eyebrow">Different voices. One team.</p>
      <h1>Better, together.</h1>
      <p>Your teammates and the accounts they have connected.</p>
      <div className="live-inline">
        <Link href="/workspace/profile">My profile & participation</Link>
        {admin && (
          <>
            <Link href="/workspace/settings">Company settings</Link>
            <Link href="/workspace/campaigns">Tracking setup</Link>
            <Link href="/workspace/audit">Activity</Link>
          </>
        )}
      </div>
      {notice && (
        <p role="status">
          {notice === "connected"
            ? "Account connected."
            : notice === "disconnected"
              ? "Account disconnected."
              : notice === "failed"
                ? "Connection could not be completed. Try again."
                : notice === "setup"
                  ? "Complete provider setup and opt in first."
                  : connectionNotice(notice)}
        </p>
      )}
      {(connectionError || healthError) && (
        <p role="alert">
          Connection status is unavailable. Apply the latest database
          migrations.
        </p>
      )}
      {programError ? (
        <p role="status">
          Participation overview is unavailable until the latest database
          update.
        </p>
      ) : (
        admin && (
          <section className="live-card">
            <h2>Program participation</h2>
            <p>
              {progress.filter((p) => p.participating).length} opted in ·{" "}
              {progress.filter((p) => p.connected).length} connected ·{" "}
              {progress.filter((p) => p.first_post).length} shared their first
              post · {progress.filter((p) => p.posts > 0).length} posted in the
              last 30 days.
            </p>
            <p>
              {
                accountHealth.filter((a) =>
                  ["reconnect", "permissions"].includes(a.state),
                ).length
              }{" "}
              connections need attention. Offer help with setup or content when
              teammates want it. Participation is optional and is not a measure
              of employee productivity.
            </p>
          </section>
        )
      )}
      {selectedPerson && (
        <section className="live-card" aria-label="Teammate performance">
          <Link href="/workspace/team">Close profile</Link>
          <div className="team-person">
            <TeamAvatar
              name={selectedPerson.display_name || "Teammate"}
              src={photoByUser.get(selectedPerson.user_id)}
            />
            <div>
              <h2>{selectedPerson.display_name}</h2>
              <p>{selectedPerson.job_title}</p>
            </div>
          </div>
          {selectedStats && (
            <p>
              Last 30 days: {selectedStats.posts} posts · {selectedStats.clicks}{" "}
              unique tracked clicks · {selectedStats.leads} attributed leads.
            </p>
          )}
          <p>
            Latest 20 published or author-selected posts. Private drafts and
            source notes are never included. Views and sales are unavailable
            until supported coverage is established.
          </p>
          {publicPosts?.error ? (
            <p>Published work is unavailable.</p>
          ) : (
            posts.map((p) => (
              <article className="live-card" key={p.id}>
                <small>
                  {p.channel === "x" ? "X" : "LinkedIn"} ·{" "}
                  {new Date(p.published_at).toLocaleDateString("en-US", {
                    timeZone: org.timezone,
                  })}
                </small>
                <details>
                  <summary>
                    {p.body.slice(0, 160)}
                    {p.body.length > 160 ? "…" : ""}
                  </summary>
                  <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
                </details>
                {p.url &&
                  /^https:\/\/(www\.)?(x\.com|linkedin\.com)\//.test(p.url) && (
                    <a href={p.url} target="_blank" rel="noreferrer">
                      View post ↗
                    </a>
                  )}
              </article>
            ))
          )}
          {!posts.length && !publicPosts?.error && (
            <p>No published work shared yet.</p>
          )}
        </section>
      )}
      <div className="team-list" role="list" aria-label="Team members">
        {profiles.map((p) => (
          <section className="team-row" role="listitem" key={p.user_id}>
            <div className="team-person">
              <TeamAvatar
                name={p.display_name || "New teammate"}
                src={photoByUser.get(p.user_id)}
              />
              <div>
                <h3>
                  <Link href={"/workspace/team?person=" + p.user_id}>
                    {p.display_name || "New teammate"}
                  </Link>
                </h3>
                <p>{p.job_title}</p>
                {progress
                  .filter((r) => r.id === p.user_id)
                  .map((r) => (
                    <small key={r.id}>
                      Account {r.connected ? "✓" : "pending"} ·{" "}
                      {r.voice_ready !== null && (
                        <>Voice {r.voice_ready ? "✓" : "pending"} · </>
                      )}
                      First post {r.first_post ? "✓" : "pending"}
                    </small>
                  ))}
              </div>
            </div>
            {(["linkedin", "x"] as const).map((channel) => {
              const name = channel === "x" ? p.x_name : p.linkedin_name;
              const expires =
                channel === "x" ? p.x_expires : p.linkedin_expires;
              const health = accountHealth.find(
                (a) => a.user_id === p.user_id && a.provider === channel,
              );
              const expired =
                health?.state === "reconnect" ||
                (!health && !!expires && Date.parse(expires) <= Date.now());
              const state = healthError
                ? "unknown"
                : health?.state || (expired ? "reconnect" : "unknown");
              const ready = channel === "x" ? !!xConfig() : !!linkedinConfig();
              return (
                <div className="team-channel" key={channel}>
                  <h4>{channel === "x" ? "X" : "LinkedIn"}</h4>
                  <small>
                    {name
                      ? `${name} · ${connectionLabel(state)}`
                      : "Not connected"}
                  </small>
                  {name && (
                    <small>
                      {health?.last_verified_at
                        ? `Profile verified ${new Date(health.last_verified_at).toLocaleString("en-US", { timeZone: org.timezone })} (${org.timezone})`
                        : "Profile not checked yet"}
                    </small>
                  )}
                  {name && channel === "x" && (
                    <small>
                      {health?.renewal_enabled
                        ? "Automatic renewal enabled"
                        : "Reconnect to enable automatic renewal"}
                    </small>
                  )}
                  {p.user_id === user.id && (
                    <>
                      {name && (
                        <form action={checkConnection}>
                          <input name="channel" type="hidden" value={channel} />
                          <button className="live-button secondary">
                            Check connection
                          </button>
                        </form>
                      )}
                      {name && (
                        <form action={disconnectChannel}>
                          <input name="channel" type="hidden" value={channel} />
                          <button className="live-button secondary">
                            Disconnect {channel === "x" ? "X" : "LinkedIn"}
                          </button>
                        </form>
                      )}
                      {(!name ||
                        expired ||
                        (channel === "x" && !health?.renewal_enabled) ||
                        health?.state === "permissions") &&
                        (ready && member.opted_in_at ? (
                          <form
                            action={`/api/social/${channel}/connect`}
                            method="post"
                          >
                            <button className="live-button">
                              {name ? "Reconnect" : "Connect"}{" "}
                              {channel === "x" ? "X" : "LinkedIn"}
                            </button>
                          </form>
                        ) : (
                          <Link
                            href={
                              member.opted_in_at
                                ? "/setup"
                                : "/workspace/profile"
                            }
                          >
                            {member.opted_in_at
                              ? "Complete connection setup"
                              : "Join the program"}
                          </Link>
                        ))}
                    </>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <p className="v1-note">
        Connection checks verify profile access, not analytics coverage or
        publishing permissions. X renews eligible authorizations automatically.
        LinkedIn asks you to reconnect when authorization expires.
        Author-approved LinkedIn/X scheduling and optional recent X post sync
        are available after setup. LinkedIn analytics requires additional
        provider access.
      </p>
      {admin && (
        <details className="v1-card">
          <summary>Manage team & invitations</summary>
          <a href="/workspace/export">Download team CSV</a>
          {token && (
            <section className="live-card">
              <h2>Your invitation is ready</h2>
              <p>
                Share this private link with the invited email address. It
                expires in seven days and can be used once.{" "}
                {notice === "invite-sent"
                  ? "The invitation email was sent."
                  : "Email delivery is not configured or failed. Share this private link directly."}
              </p>
              <input
                aria-label="Invitation link"
                readOnly
                value={appUrl() + "/invite/" + token}
              />
            </section>
          )}
          <form action={inviteMember} className="live-card">
            <h2>Invite a teammate</h2>
            <label>
              Work email
              <input name="email" type="email" required />
            </label>
            <label>
              Role
              <select name="role">
                <option value="teammate">Teammate</option>
                <option value="viewer">Viewer</option>
                {member.role === "owner" && (
                  <option value="admin">Admin</option>
                )}
                <option value="payroll_approver">Payroll approver</option>
              </select>
            </label>
            <button className="live-button">Create invitation</button>
          </form>
          {team?.map((m) => (
            <section className="live-card" key={m.user_id}>
              <h2>{m.display_name || "New member"}</h2>
              <p>
                {m.role} ·{" "}
                {m.opted_in_at ? "Joined the program" : "Not opted in"}
              </p>
              {m.user_id !== user.id && m.role !== "owner" && (
                <form action={changeMember}>
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <label>
                    Role
                    <select name="role" defaultValue={m.role}>
                      {["teammate", "viewer", "admin", "payroll_approver"].map(
                        (r) => (
                          <option key={r}>{r}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    <input type="checkbox" name="remove" />
                    Remove from the company and delete private drafts and
                    connections
                  </label>
                  <button className="live-button secondary">
                    Update member
                  </button>
                </form>
              )}
            </section>
          ))}
        </details>
      )}
    </div>
  );
}
