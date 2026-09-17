import { workspace, serviceDatabase } from "@/lib/supabase/server";
import { linkedinConfig } from "@/lib/social/linkedin";
import { disconnectLinkedIn } from "@/lib/social/actions";
import { recorders } from "@/lib/calls/providers";
import Link from "next/link";
export default async function Connections() {
  const { user, org, member } = await workspace();
  let account: { display_name: string; expires_at: string } | null = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await serviceDatabase()
      .from("social_accounts")
      .select("display_name,expires_at")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .eq("provider", "linkedin")
      .single();
    account = data;
  }
  const ready = !!linkedinConfig();
  return (
    <>
      <h1>Connect your everyday tools.</h1>
      <section className="live-card">
        <h2>LinkedIn</h2>
        {account ? (
          <>
            <p>
              Connected as {account.display_name}. Authorization expires{" "}
              {new Date(account.expires_at).toLocaleDateString("en-US")}.
            </p>
            <form action={disconnectLinkedIn}>
              <button className="live-button secondary">
                Disconnect my profile
              </button>
            </form>
          </>
        ) : (
          <>
            <p>
              Connect your own profile to publish posts you have explicitly
              approved.
            </p>
            {ready && member.opted_in_at ? (
              <form action="/api/social/linkedin/connect" method="post">
                <button className="live-button">Connect LinkedIn</button>
              </form>
            ) : (
              <Link href={member.opted_in_at ? "/setup" : "/workspace/profile"}>
                {member.opted_in_at
                  ? "Complete LinkedIn setup"
                  : "Join the program first"}
              </Link>
            )}
          </>
        )}
        <p>
          Manual publishing is available without a connection. Personal post
          analytics needs separate LinkedIn approval.
        </p>
      </section>
      <h2>Call recording sources</h2>
      <p>
        Provider connections are not live yet. Do not upload confidential
        recordings until privacy processing and each provider’s access checks
        are verified.
      </p>
      <div className="live-grid">
        {recorders.map((p) => (
          <section className="live-card" key={p.id}>
            <h2>{p.name}</h2>
            <span className="status">Setup pending</span>
            <p>{p.requirement}</p>
            <a href={p.docs} target="_blank" rel="noreferrer">
              Provider documentation ↗
            </a>
          </section>
        ))}
      </div>
    </>
  );
}
