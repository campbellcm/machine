export const dynamic = "force-dynamic";
import { signedIn } from "@/lib/supabase/server";
import { createCompany } from "@/app/workspace/actions";
export default async function Onboarding() {
  await signedIn();
  return (
    <main className="live-page narrow">
      <h1>Create your company</h1>
      <p>Your company’s drafts and activity stay in its private workspace.</p>
      <form className="live-card" action={createCompany}>
        <label>
          Company name
          <input name="name" maxLength={100} required />
        </label>
        <label>
          Website
          <input
            name="website"
            type="url"
            placeholder="https://example.com"
            required
          />
        </label>
        <label>
          Timezone
          <select name="timezone">
            {Intl.supportedValuesOf("timeZone").map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button className="live-button">Create workspace</button>
      </form>
    </main>
  );
}
