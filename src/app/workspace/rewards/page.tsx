import { RewardRow } from "@/components/v1/reward-row";
import { workspace } from "@/lib/supabase/server";
import { createReward, fulfillReward } from "./actions";
export default async function Rewards({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { db, org, member } = await workspace();
  const { notice } = await searchParams;
  const admin = ["owner", "admin"].includes(member.role);
  const { data: rewards, error } = await db
    .from("challenges")
    .select("*")
    .eq("organization_id", org.id)
    .order("starts_at", { ascending: false });
  const [{ data: team }, { data: photos }] = await Promise.all([
    db.rpc("team_connections", { org: org.id }), db.rpc("team_photos", { org: org.id }),
  ]);
  return (
    <div className="v1">
      <p className="eyebrow">Good work deserves recognition</p>
      <h1>Your next big win.</h1>
      <p>See what’s up for grabs and who’s leading the way.</p>
      {notice && (
        <p role="status">
          {notice === "saved"
            ? "Reward created."
            : notice === "fulfilled"
              ? "Fulfillment recorded."
              : "Could not save. Check the required fields, dates, and your permissions."}
        </p>
      )}
      {error && (
        <p role="alert">Rewards could not be loaded. Check database setup.</p>
      )}
      {admin && (
        <details className="v1-card">
          <summary>Create a reward</summary>
          <form action={createReward} className="v1-form">
            <label>
              Title
              <input name="title" required maxLength={100} />
            </label>
            <label>
              Prize
              <input
                name="prize"
                required
                maxLength={500}
                placeholder="$1,000, a MacBook Pro, a trip…"
              />
            </label>
            <label>
              Most
              <select name="metric">
                <option value="leads">Leads and demo requests</option>
                <option value="unique_clicks">Unique clicks</option>
                <option value="published_posts">Verified posts</option>
                <option disabled>
                  Impressions · analytics integration required
                </option>
                <option disabled>Sales · CRM integration required</option>
              </select>
            </label>
            <label>
              Rules
              <textarea name="rules" maxLength={9000} required />
            </label>
            <label>
              Starts (date, time, and UTC offset)
              <input
                name="start"
                placeholder="2026-10-01T00:00:00-04:00"
                required
              />
            </label>
            <label>
              Ends (date, time, and UTC offset)
              <input
                name="end"
                placeholder="2026-11-01T00:00:00-04:00"
                required
              />
            </label>
            <p className="v1-note">
              All opted-in members participate. Ties go to the earliest final
              scoring event, then stable member ID. Results settle for 72 hours.
              Rules and prize lock on creation. Your company fulfills the prize
              outside the app.
            </p>
            <button className="live-button">Create reward</button>
          </form>
        </details>
      )}
      <div className="rewards-list">
        {await Promise.all(
          (rewards || []).map(async (r) => {
            const { data: scores, error: scoreError } =
              r.status === "ended"
                ? await db
                    .from("challenge_results")
                    .select("user_id,score,rank,is_winner")
                    .eq("challenge_id", r.id)
                    .order("rank")
                : await db.rpc("challenge_scores", { challenge: r.id });
            return (
              <RewardRow key={r.id} title={r.name} prize={r.prize || "Recognition"} status={r.status}
                metric={r.metric === "unique_clicks" ? "unique clicks" : r.metric === "published_posts" ? "verified posts" : "leads"}
                dates={`${new Date(r.starts_at).toLocaleDateString("en-US", { timeZone: org.timezone })} — ${new Date(r.ends_at).toLocaleDateString("en-US", { timeZone: org.timezone })} (${org.timezone})`}
                rules={`${r.rules} Eligibility window: ${new Date(r.starts_at).toLocaleString("en-US", { timeZone: org.timezone })} through ${new Date(r.ends_at).toLocaleString("en-US", { timeZone: org.timezone })} (${org.timezone}).`} error={!!scoreError}
                leaders={((scores || []) as { user_id: string; display_name?: string; score: number; rank?: number }[]).map(s => ({
                  id: s.user_id, name: s.display_name || team?.find((p: { user_id: string }) => p.user_id === s.user_id)?.display_name || "Former teammate",
                  photo: photos?.find((p: { user_id: string }) => p.user_id === s.user_id)?.photo_url, score: Number(s.score), rank: s.rank,
                }))}>
                {r.fulfilled_at ? (
                  <p>Prize fulfilled</p>
                ) : (
                  admin &&
                  r.status === "ended" && (
                    <form action={fulfillReward}>
                      <input type="hidden" name="id" value={r.id} />
                      <label className="check-label">
                        <input type="checkbox" name="confirmed" required />
                        The company has delivered this prize.
                      </label>
                      <button className="live-button secondary">
                        Mark fulfilled
                      </button>
                    </form>
                  )
                )}
              </RewardRow>
            );
          }),
        )}
      </div>
      {!error && !rewards?.length && (
        <section className="v1-card">
          <h2>No rewards yet.</h2>
          <p>Your company’s rewards will appear here.</p>
        </section>
      )}
    </div>
  );
}
