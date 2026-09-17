import Link from "next/link";
import { workspace } from "@/lib/supabase/server";
import { productName } from "@/lib/config";
import { signOut } from "@/app/login/actions";
import { switchCompany } from "./actions";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { org, member, members } = await workspace();
  const admin = ["owner", "admin"].includes(member.role);
  return (
    <div className="live-page">
      <header className="live-top">
        <div>
          <Link href="/workspace">{productName}</Link>
          <small>
            {org.name} · {member.role.replace("_", " ")}
          </small>
        </div>
        <div className="live-inline">
          {members.length > 1 && (
            <form action={switchCompany}>
              <select
                aria-label="Company"
                name="organization_id"
                defaultValue={org.id}
              >
                {members.map((m) => (
                  <option value={m.organization_id} key={m.organization_id}>
                    {m.organization_id === org.id
                      ? org.name
                      : m.organization_id}
                  </option>
                ))}
              </select>
              <button className="live-button secondary">Switch</button>
            </form>
          )}
          <form action={signOut}>
            <button className="live-button secondary">Sign out</button>
          </form>
        </div>
      </header>
      <nav className="live-nav" aria-label="Workspace navigation">
        <Link href="/workspace">Overview</Link>
        <Link href="/workspace/challenges">Challenges</Link>
        <Link href="/workspace/roadmap">Build status</Link>
        {["owner", "admin", "teammate"].includes(member.role) && (
          <>
            <Link href="/workspace/drafts">My drafts</Link>
            <Link href="/workspace/interview">Interview</Link>
            <Link href="/workspace/ideas">Ideas</Link>
            <Link href="/workspace/connections">Connections</Link>
            <Link href="/workspace/profile">My profile</Link>
          </>
        )}
        {admin && (
          <>
            <Link href="/workspace/team">Team</Link>
            <Link href="/workspace/settings">Company settings</Link>
            <Link href="/workspace/campaigns">Tracking</Link>
            <Link href="/workspace/audit">Activity</Link>
          </>
        )}
      </nav>
      <main>{children}</main>
    </div>
  );
}
