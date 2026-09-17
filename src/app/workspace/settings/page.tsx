import { notFound } from "next/navigation";
import { workspace } from "@/lib/supabase/server";
import { saveCompany } from "../actions";
export default async function Settings() {
  const { org, member } = await workspace();
  if (!["owner", "admin"].includes(member.role)) notFound();
  return (
    <>
      <h1>Give your team a starting point.</h1>
      <form action={saveCompany} className="live-card">
        <label>
          Company context
          <textarea
            name="context"
            defaultValue={org.context}
            maxLength={60000}
            placeholder="What we sell, who buys it, recent wins, and our point of view."
          />
        </label>
        <small>
          Up to 60,000 characters. Include only information approved for public
          use.
        </small>
        <label>
          Brand voice
          <textarea name="voice" defaultValue={org.voice} maxLength={4000} />
        </label>
        <label>
          Blocked phrases and competitors, one per line
          <textarea
            name="blocked"
            defaultValue={org.blocked_phrases.join("\n")}
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="review"
            defaultChecked={org.admin_review_required}
          />
          Require an admin review before the author’s final approval
        </label>
        <p>
          Employment disclosure is locked: “I work at {org.name}.” must appear
          in the first two lines. Your legal team should approve this wording.
        </p>
        <p>
          Saving these settings resets existing approvals so drafts are reviewed
          against the new rules.
        </p>
        <button className="live-button">Save company settings</button>
      </form>
    </>
  );
}
