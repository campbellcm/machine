import Link from "next/link";
import { productName } from "@/lib/config";
import { supabaseConfig } from "@/lib/supabase/config";
import { sendMagicLink, googleSignIn } from "./actions";
const messages: Record<string, string> = {
  "check-email": "Check your email for your sign-in link.",
  "invalid-email": "Enter a valid email address.",
  "try-again":
    "We could not send a link. Check email setup or try again shortly.",
  "google-setup": "Google sign-in needs to be enabled in Supabase.",
  "expired-link": "That link is expired or already used. Request a new one.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const ready = !!supabaseConfig();
  return (
    <main className="live-page narrow">
      <Link href="/">{productName}</Link>
      <h1>Your expertise. Your voice.</h1>
      <p>Sign in to your private workspace.</p>
      {message && (
        <p role="status" className="live-notice">
          {messages[message] || "Please try again."}
        </p>
      )}
      {!ready ? (
        <section className="live-card">
          <h2>Let’s connect your workspace</h2>
          <p>
            Sign-in becomes available after the database and email service are
            configured.
          </p>
          <Link className="live-button" href="/setup">
            Set up {productName}
          </Link>
        </section>
      ) : (
        <section className="live-card">
          <form action={sendMagicLink}>
            <label>
              Work email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <button className="live-button">Email me a sign-in link</button>
          </form>
          <form action={googleSignIn}>
            <button className="live-button secondary">
              Continue with Google
            </button>
          </form>
        </section>
      )}
      <Link href="/demo">Explore the sample workspace</Link>
    </main>
  );
}
