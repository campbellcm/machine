import { workspace } from "@/lib/supabase/server";
import { createChallenge } from "./actions";
export default async function Challenges() {
  const { db, org, member } = await workspace();
  const { data: challenges } = await db
    .from("challenges")
    .select("*")
    .eq("organization_id", org.id)
    .order("starts_at", { ascending: false });
  return (
    <>
      <h1>Build a habit together.</h1>
      <p>
        Private company challenges. These challenges offer recognition only;
        cash rewards and payroll are not enabled.
      </p>
      {["owner", "admin"].includes(member.role) && (
        <form className="live-card" action={createChallenge}>
          <h2>Create a no-reward challenge</h2>
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Rules
            <textarea name="rules" required maxLength={10000} />
          </label>
          <label>
            Metric
            <select name="metric">
              <option value="leads">Leads and demo requests</option>
              <option value="unique_clicks">Unique clicks</option>
              <option value="published_posts">Verified published posts</option>
            </select>
          </label>
          <label>
            Start time with timezone offset
            <input
              name="start"
              placeholder="2026-10-01T00:00:00-04:00"
              required
            />
          </label>
          <label>
            End time with timezone offset
            <input
              name="end"
              placeholder="2026-11-01T00:00:00-04:00"
              required
            />
          </label>
          <small>
            Company timezone: {org.timezone}. Include its applicable offset.
            Results settle for 72 hours after the end.
          </small>
          <label>
            Winners
            <input
              name="winners"
              type="number"
              min={1}
              max={10}
              defaultValue={1}
            />
          </label>
          <button className="live-button">Create challenge</button>
        </form>
      )}
      {await Promise.all(
        (challenges || []).map(async (c) => {
          const { data: scores } =
            c.status === "ended"
              ? await db
                  .from("challenge_results")
                  .select("user_id,score,rank,is_winner")
                  .eq("challenge_id", c.id)
                  .order("rank")
              : await db.rpc("challenge_scores", { challenge: c.id });
          return (
            <section className="live-card" key={c.id}>
              <span className="status">{c.status}</span>
              <h2>{c.name}</h2>
              <p>{c.rules}</p>
              <p>
                {new Date(c.starts_at).toLocaleString("en-US", {
                  timeZone: org.timezone,
                })}{" "}
                –{" "}
                {new Date(c.ends_at).toLocaleString("en-US", {
                  timeZone: org.timezone,
                })}
              </p>
              <ol>
                {(
                  scores as
                    | {
                        user_id: string;
                        display_name?: string;
                        score: number;
                      }[]
                    | null
                )?.map((s) => (
                  <li key={s.user_id}>
                    {s.display_name || "Teammate"}: {s.score}
                  </li>
                ))}
              </ol>
            </section>
          );
        }),
      )}
    </>
  );
}
