import Link from "next/link";
import { workspace } from "@/lib/supabase/server";
export default async function Dashboard() {
  const { db, member, org } = await workspace();
  const admin = ["owner", "admin", "viewer"].includes(member.role);
  const [{ count: posts }, { count: clicks }, { count: conversions }] =
    await Promise.all([
      db
        .from("drafts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("status", "published"),
      db
        .from("link_clicks")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id)
        .eq("is_bot", false)
        .eq("is_duplicate", false),
      db
        .from("conversions")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", org.id),
    ]);
  return (
    <>
      <span className="eyebrow">Your live workspace</span>
      <h1>
        {member.display_name
          ? `Welcome back, ${member.display_name.split(" ")[0]}.`
          : "Let’s get your voice out there."}
      </h1>
      <p>
        {admin ? "Your company’s" : "Your"} real activity, all time. Sample data
        is never included.
      </p>
      <div className="live-grid">
        {[
          ["Published posts", posts],
          ["Unique clicks", clicks],
          ["Conversions", conversions],
        ].map(([label, value]) => (
          <section className="live-card" key={label}>
            <p>{label}</p>
            <div className="live-stat">{value ?? 0}</div>
          </section>
        ))}
      </div>
      {["owner", "admin", "teammate"].includes(member.role) && (
        <section className="live-card">
          <h2>
            {member.opted_in_at
              ? "Share something you learned."
              : "Participation starts with you."}
          </h2>
          <p>
            {member.opted_in_at
              ? "Write a draft, review the exact words, and choose when to publish."
              : "Join the program and complete your profile before creating posts."}
          </p>
          <Link
            className="live-button"
            href={
              member.opted_in_at ? "/workspace/drafts" : "/workspace/profile"
            }
          >
            {member.opted_in_at ? "Create a draft" : "Complete my profile"}
          </Link>
        </section>
      )}
      <p>
        LinkedIn impressions appear only after approved analytics access. A
        manual post without its URL is marked unverified.
      </p>
    </>
  );
}
