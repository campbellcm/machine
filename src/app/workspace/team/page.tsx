import { cookies } from "next/headers";
import { notFound } from "next/navigation";
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
  if (!["owner", "admin"].includes(member.role)) notFound();
  const { data: team } = await db
    .from("memberships")
    .select("*")
    .eq("organization_id", org.id)
    .is("removed_at", null);
  const token = (await cookies()).get("crewcast_invite")?.value;
  return (
    <>
      <h1>A team of distinct voices.</h1>
      <a href="/workspace/export">Download team CSV</a>
      {token && (
        <section className="live-card">
          <h2>Your invitation is ready</h2>
          <p>
            Share this private link with the invited email address. It expires
            in seven days and can be used once. {notice==='invite-sent'?'The invitation email was sent.':'Email delivery is not configured or failed. Share this private link directly.'}
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
            {member.role === "owner" && <option value="admin">Admin</option>}
            <option value="payroll_approver">Payroll approver</option>
          </select>
        </label>
        <button className="live-button">Create invitation</button>
      </form>
      {team?.map((m) => (
        <section className="live-card" key={m.user_id}>
          <h2>{m.display_name || "New member"}</h2>
          <p>
            {m.role} · {m.opted_in_at ? "Joined the program" : "Not opted in"}
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
              <button className="live-button secondary">Update member</button>
            </form>
          )}
        </section>
      ))}
    </>
  );
}
