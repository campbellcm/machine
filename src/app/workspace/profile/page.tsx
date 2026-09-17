import { workspace } from "@/lib/supabase/server";
import { saveProfile } from "../actions";
export default async function Profile() {
  const { member, org } = await workspace();
  return (
    <>
      <h1>Your voice, your choice.</h1>
      <section className="live-card">
        <h2>Participation is optional</h2>
        <p>
          Nothing posts without your approval. We store your drafts, link
          activity, attributed leads, and connected post performance. Your posts
          disclose that you work at {org.name}. If your company offers rewards,
          they are paid through company payroll and taxed like other pay.
        </p>
        <p>
          You can leave anytime. Leaving deletes your unpublished drafts,
          interviews, and connected-account tokens. Already-earned rewards are
          unaffected.
        </p>
      </section>
      <form action={saveProfile} className="live-card">
        <label>
          Your name
          <input
            name="name"
            defaultValue={member.display_name}
            required
            maxLength={100}
          />
        </label>
        <label>
          Profile photo URL
          <input name="photo_url" type="url" placeholder="https://…" defaultValue={member.photo_url || ""} maxLength={2048} />
          <small>Use an HTTPS link to your photo. Leave blank to show initials.</small>
        </label>
        <label>
          Job title
          <input name="title" defaultValue={member.job_title} maxLength={120} />
        </label>
        <label>
          Department
          <input
            name="department"
            defaultValue={member.department}
            maxLength={100}
          />
        </label>
        <label>
          Three to five expertise topics, separated by commas
          <input
            name="topics"
            defaultValue={member.topics.join(", ")}
            required
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="consent"
            defaultChecked={!!member.opted_in_at}
          />
          I choose to join the program. Uncheck and save to leave.
        </label>
        <button className="live-button">Save my profile</button>
      </form>
    </>
  );
}
