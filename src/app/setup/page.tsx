import { implementationStatus } from "@/lib/implementation-status";
import Link from "next/link";
import { productName } from "@/lib/config";
export const dynamic = "force-dynamic";
export default function Setup() {
  return (
    <main className="live-page">
      <div className="live-top">
        <Link href="/login">{productName}</Link>
        <Link href="/demo">Sample workspace</Link>
      </div>
      <span className="eyebrow">Launch checklist</span>
      <h1>Make this workspace yours.</h1>
      <p>
        Follow these steps to enable real accounts, private drafts, and LinkedIn
        publishing. Keep secret keys in your hosting settings, never in a post
        or chat.
      </p>
      <div className="live-grid">
        <section className="live-card">
          <span className="eyebrow">01 · Private workspace</span>
          <h2>Create your Supabase project</h2>
          <p>
            Create a project, then apply the migrations in this project’s{" "}
            <code>supabase/migrations</code> folder in filename order. Set the
            project URL and publishable key in your app’s environment settings.
          </p>
          <p>
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
            <br />
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>
            <br />
            <code>SUPABASE_SERVICE_ROLE_KEY</code> (server only)
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Open Supabase ↗
          </a>
        </section>
        <section className="live-card">
          <span className="eyebrow">02 · Sign-in</span>
          <h2>Enable your sign-in emails</h2>
          <p>
            In Supabase Authentication, set your site URL and allow{" "}
            <code>/auth/callback</code> on your app’s domain. Configure a
            verified sender with custom SMTP for production. Enable Google if
            you want Google sign-in.
          </p>
          <p>
            Use the default magic-link email template. Set{" "}
            <code>NEXT_PUBLIC_APP_URL</code> to the same app origin, then
            restart or redeploy.
          </p>
          <a
            href="https://supabase.com/docs/guides/auth/auth-smtp"
            target="_blank"
            rel="noreferrer"
          >
            Email setup guide ↗
          </a>
        </section>
        <section className="live-card">
          <span className="eyebrow">03 · Personal LinkedIn profiles</span>
          <h2>Register a LinkedIn application</h2>
          <p>
            Associate your LinkedIn Company Page. Request “Sign In with LinkedIn
            using OpenID Connect” and “Share on LinkedIn.” Add your HTTPS app
            URL followed by <code>/api/social/linkedin/callback</code> as an
            authorized redirect.
          </p>
          <p>
            Set <code>LINKEDIN_CLIENT_ID</code>,{" "}
            <code>LINKEDIN_CLIENT_SECRET</code>, and a random 32-byte base64{" "}
            <code>TOKEN_ENCRYPTION_KEY</code>. Each teammate connects their own
            profile and approves their own posts.
          </p>
          <a
            href="https://www.linkedin.com/developers/apps"
            target="_blank"
            rel="noreferrer"
          >
            Open LinkedIn developers ↗
          </a>
        </section>
        <section className="live-card">
          <span className="eyebrow">04 · First real activity</span>
          <h2>Run a small pilot</h2>
          <ol>
            <li>Sign in, create your company, and join the program.</li>
            <li>Add company context and invite a teammate.</li>
            <li>
              Write and approve a draft. Manual publishing works before LinkedIn
              API approval.
            </li>
            <li>
              Connect a profile, publish an approved post, and verify it on
              LinkedIn.
            </li>
            <li>Share a tracked link and send a test conversion.</li>
          </ol>
          <p>
            Do not treat a saved setting as proof an integration works: verify
            the first real sign-in and post with your test accounts.
          </p>
        </section>
      </div>
      <p>
        <Link className="live-button" href="/login">
          Continue to sign-in
        </Link>
      </p>
      <section className="live-card">
        <h2>AI drafts and invitations</h2>
        <p>
          For interview-based generation, add <code>ANTHROPIC_API_KEY</code> and{" "}
          <code>ANTHROPIC_MODEL</code>. Set a spending limit in your Anthropic
          account. For invitations, configure <code>RESEND_API_KEY</code> and a
          verified <code>EMAIL_FROM</code>.
        </p>
        <p>
          For scheduled publishing and challenge settlement, set{" "}
          <code>CRON_SECRET</code> and enable the supplied 15-minute Vercel
          schedule on a plan that supports it. For click attribution, set{" "}
          <code>VISITOR_HASH_SALT</code> to a random secret.
        </p>
      </section>
      <h2>Implementation status</h2>
      <p>
        Account setup unlocks the implemented flows. The remaining roadmap still
        needs development.
      </p>
      <div className="live-grid">
        {implementationStatus.map((item) => (
          <section className="live-card" key={item.area}>
            <span className="status">{item.status}</span>
            <h2>{item.area}</h2>
            <p>{item.detail}</p>
          </section>
        ))}
      </div>
      <p>
        Advanced integrations, analytics access, billing, and payroll have
        additional account and review requirements. See the project’s
        implementation status before inviting a broader team.
      </p>
    </main>
  );
}
