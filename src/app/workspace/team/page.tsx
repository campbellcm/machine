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
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
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
      <div className="team-list" role="list" aria-label="Team members">
        {profiles.map((p) => (
          <section className="team-row" role="listitem" key={p.user_id}>
            <div className="team-person">
              <TeamAvatar
                name={p.display_name || "New teammate"}
                src={photoByUser.get(p.user_id)}
              />
              <div>
                <h3>{p.display_name || "New teammate"}</h3>
                <p>{p.job_title}</p>
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
        LinkedIn asks you to reconnect when authorization expires. Scheduled X
        publishing and analytics sync are not enabled yet.
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
