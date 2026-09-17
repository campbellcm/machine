"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { database } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
export async function sendMagicLink(form: FormData) {
  const parsed = z.email().max(254).safeParse(form.get("email"));
  if (!parsed.success) redirect("/login?message=invalid-email");
  const db = await database();
  const { error } = await db.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: appUrl() + "/auth/callback" },
  });
  redirect("/login?message=" + (error ? "try-again" : "check-email"));
}
export async function googleSignIn() {
  const db = await database();
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: appUrl() + "/auth/callback" },
  });
  if (error || !data.url) redirect("/login?message=google-setup");
  redirect(data.url);
}
export async function signOut() {
  const db = await database();
  await db.auth.signOut();
  redirect("/login");
}
