import Link from "next/link";
import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signedIn } from "@/lib/supabase/server";
export default async function Invite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  async function accept() {
    "use server";
    const { db } = await signedIn();
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      redirect("/workspace?notice=invalid-invite");
    const { data, error } = await db.rpc("accept_invitation", {
      hashed_token: createHash("sha256").update(token).digest("hex"),
    });
    if (error) redirect("/workspace?notice=invalid-invite");
    (await cookies()).set("crewcast_org", data, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    redirect("/workspace/profile");
  }
  return (
    <main className="live-page narrow">
      <h1>You’re invited.</h1>
      <p>
        First sign in with the email address that received the invitation, then
        return to this link to join.
      </p>
      <Link className="live-button secondary" href="/login">
        Sign in
      </Link>
      <form action={accept}>
        <button className="live-button">Accept invitation</button>
      </form>
    </main>
  );
}
