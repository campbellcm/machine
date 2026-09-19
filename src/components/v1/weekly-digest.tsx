import { workspace } from "@/lib/supabase/server";
import { saveWeeklyDigest } from "@/lib/delivery/weekly-actions";
export async function WeeklyDigest({ notice }: { notice?: string }) {
  const { db, org, user } = await workspace();
  const [pref, history] = await Promise.all([
    db
      .from("weekly_preferences")
      .select("enabled,channel")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("weekly_deliveries")
      .select("id,week_start,status,channel")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  return (
    <details className="live-card">
      <summary>Your weekly team digest</summary>
      <h2>A clearer picture of your week.</h2>
      <p>
        Get participation, published posts, tracked clicks and attributed leads,
        plus a suggested next step. The report covers the previous Monday–Sunday
        in UTC. No private drafts or source notes are included.
      </p>
      {notice && (
        <p role="status">
          {notice === "saved"
            ? "Your digest preference is saved."
            : "Could not save. Check setup and your participation status."}
        </p>
      )}
      {pref.error || history.error ? (
        <p>
          Apply the latest database migrations in <a href="/setup">Setup</a>.
        </p>
      ) : (
        <>
          <form action={saveWeeklyDigest} className="live-form">
            <label>
              Deliver to
              <select
                name="channel"
                defaultValue={pref.data?.channel || "email"}
              >
                <option value="email">My verified email</option>
                <option value="slack">
                  My connected Slack direct messages
                </option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={pref.data?.enabled || false}
              />{" "}
              Send me a weekly summary of this team’s shared performance.
            </label>
            <button className="live-button">Save my preference</button>
          </form>
          <p>
            Email requires company delivery setup. Connect Slack delivery in AI
            before choosing Slack. Delivery runs after the week ends; queues can
            delay it. Uncheck the box to stop future digests.
          </p>
          <ul>
            {history.data?.map((d) => (
              <li key={d.id}>
                Week of {d.week_start.slice(0, 10)} · {d.channel} · {d.status}
              </li>
            ))}
          </ul>
          <p>
            Failed: check your verified email or reconnect Slack. Uncertain:
            delivery could not be confirmed and will not be repeated, to avoid
            duplicates. The next weekly digest remains scheduled while enabled.
          </p>
        </>
      )}
    </details>
  );
}
