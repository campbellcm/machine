import { RewardCreate } from "@/components/v1/reward-create";
import { RewardRow } from "@/components/v1/reward-row";
import { workspace } from "@/lib/supabase/server";
import { fulfillReward } from "./actions";
export default async function Rewards({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { db, org, member, user } = await workspace();
  const { notice } = await searchParams;
  // Server-rendered countdown evaluated once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const admin = ["owner", "admin"].includes(member.role);
  const { data: rewards, error } = await db
    .from("challenges")
    .select("*")
    .eq("organization_id", org.id)
    .order("starts_at", { ascending: false });
  const [{ data: team }, { data: photos }] = await Promise.all([
    db.rpc("team_connections", { org: org.id }),
    db.rpc("team_photos", { org: org.id }),
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
      {admin && <RewardCreate />}
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
              <RewardRow
                key={r.id}
                title={r.name}
                prize={r.prize || "Recognition"}
                status={r.status}
                metric={
                  (
                    {
                      unique_clicks: "unique clicks",
                      published_posts: "verified posts",
                      active_days: "publishing days",
                      improvement_posts: "additional posts",
                      first_post: "first recorded post",
                      team_posts: "team posts",
                      leads: "leads",
                    } as Record<string, string>
                  )[r.metric] || r.metric
                }
                timeRemaining={
                  Date.parse(r.ends_at) > now
                    ? `${Math.ceil((Date.parse(r.ends_at) - now) / 86400000)} days until the challenge closes.`
                    : r.status === "ended"
                      ? "Final results are confirmed."
                      : "Scoring window closed. Waiting for settlement."
                }
                milestone={r.metric === "first_post"}
                personalId={user.id}
                target={r.target}
                endsAt={r.ends_at}
                startsAt={r.starts_at}
                teamGoal={r.metric === "team_posts"}
                dates={`${new Date(r.starts_at).toLocaleDateString("en-US", { timeZone: org.timezone })} — ${new Date(r.ends_at).toLocaleDateString("en-US", { timeZone: org.timezone })} (${org.timezone})`}
                rules={`${r.rules} Eligibility window: ${new Date(r.starts_at).toLocaleString("en-US", { timeZone: org.timezone })} through ${new Date(r.ends_at).toLocaleString("en-US", { timeZone: org.timezone })} (${org.timezone}).`}
                error={!!scoreError}
                leaders={(
                  (scores || []) as {
                    user_id: string;
                    display_name?: string;
                    score: number;
                    rank?: number;
                  }[]
                ).map((s) => ({
                  id: s.user_id,
                  name:
                    s.display_name ||
                    team?.find(
                      (p: { user_id: string }) => p.user_id === s.user_id,
                    )?.display_name ||
                    "Former teammate",
                  photo: photos?.find(
                    (p: { user_id: string }) => p.user_id === s.user_id,
                  )?.photo_url,
                  score: Number(s.score),
                  rank: s.rank,
                }))}
              >
                {r.status === "ended" &&
                  (scores || []).some(
                    (s: { user_id: string; is_winner?: boolean }) =>
                      s.user_id === user.id && s.is_winner,
                  ) && (
                    <p role="status">
                      <strong>You won this reward.</strong>{" "}
                      {r.fulfilled_at
                        ? "Your company marked the prize delivered."
                        : "Your company will arrange the prize."}
                    </p>
                  )}
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
