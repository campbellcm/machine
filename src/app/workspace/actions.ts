"use server";
import { sendInvitation } from "@/lib/email/send";
import { appUrl } from "@/lib/supabase/config";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { signedIn, workspace } from "@/lib/supabase/server";
const str = (f: FormData, k: string) => String(f.get(k) || "");
const uuid = (f: FormData, k: string) => z.uuid().parse(f.get(k));
function finish(error: unknown, path = "/workspace") {
  if (error) redirect(path + "?notice=not-saved");
  revalidatePath("/workspace", "layout");
  redirect(path + "?notice=saved");
}
export async function createCompany(f: FormData) {
  const { db } = await signedIn();
  const name = z.string().trim().min(1).max(100).parse(f.get("name"));
  const website = z.url().parse(f.get("website"));
  const { data, error } = await db.rpc("create_organization", {
    company_name: name,
    company_website: website,
    company_timezone: str(f, "timezone"),
  });
  if (error) redirect("/onboarding?notice=not-saved");
  (await cookies()).set("crewcast_org", data, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl().startsWith("https:"),
    path: "/",
  });
  redirect("/workspace/profile");
}
export async function switchCompany(f: FormData) {
  const { db, user } = await signedIn();
  const id = uuid(f, "organization_id");
  const { data } = await db
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", id)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .single();
  if (!data) redirect("/workspace");
  (await cookies()).set("crewcast_org", id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/workspace");
}
export async function saveProfile(f: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("save_profile", {
    org: org.id,
    person_name: z.string().trim().min(1).max(100).parse(f.get("name")),
    title: str(f, "title"),
    team: str(f, "department"),
    expertise: str(f, "topics")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    consent: f.get("consent") === "on",
  });
  finish(error, "/workspace/profile");
}
export async function saveCompany(f: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("save_company", {
    org: org.id,
    company_context: z.string().max(60000).parse(f.get("context")),
    brand_voice: str(f, "voice"),
    blocked: str(f, "blocked")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean),
    review_required: f.get("review") === "on",
  });
  finish(error, "/workspace/settings");
}
export async function inviteMember(f: FormData) {
  const { db, org } = await workspace();
  const email = z.email().parse(f.get("email"));
  const role = z
    .enum(["admin", "teammate", "viewer", "payroll_approver"])
    .parse(f.get("role"));
  const token = randomBytes(32).toString("base64url");
  const { data: invitationId, error } = await db.rpc("create_invitation", {
    org: org.id,
    invite_email: email,
    invite_role: role,
    hashed_token: createHash("sha256").update(token).digest("hex"),
  });
  if (error) finish(error, "/workspace/team");
  // Short-lived HttpOnly cookie displays the invitation once without query-string leakage.
  (await cookies()).set("crewcast_invite", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: appUrl().startsWith("https:"),
    maxAge: 120,
    path: "/workspace/team",
  });
  const delivered = await sendInvitation(
    email,
    org.name,
    appUrl() + "/invite/" + token,
    invitationId,
  );
  redirect(
    "/workspace/team?notice=" + (delivered ? "invite-sent" : "invite-created"),
  );
}
export async function changeMember(f: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("manage_member", {
    org: org.id,
    person: uuid(f, "user_id"),
    new_role: str(f, "role"),
    remove_member: f.get("remove") === "on",
  });
  finish(error, "/workspace/team");
}
export async function saveDraft(f: FormData) {
  const { db, org } = await workspace();
  const id = str(f, "id");
  const { error } = await db.rpc("save_channel_draft", {
    target_channel: z
      .enum(["linkedin", "x"])
      .parse(f.get("channel") || "linkedin"),
    org: org.id,
    draft: id ? z.uuid().parse(id) : null,
    content: z.string().trim().min(1).max(3000).parse(f.get("body")),
    expected_revision: id ? Number(f.get("revision")) : null,
  });
  finish(error, "/workspace/drafts");
}
export async function transitionDraft(f: FormData) {
  const { db } = await workspace();
  const { error } = await db.rpc("transition_draft", {
    draft: uuid(f, "id"),
    expected_revision: Number(f.get("revision")),
    operation: z
      .enum(["approve", "submit", "review", "request_changes"])
      .parse(f.get("operation")),
  });
  finish(error, "/workspace/drafts");
}
export async function recordManual(f: FormData) {
  const { db } = await workspace();
  let url = str(f, "url").trim();
  if (url) {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    url = u.toString();
  }
  const { error } = await db.rpc(
    f.get("channel") === "x" ? "record_x_post" : "record_manual_post",
    {
      draft: uuid(f, "id"),
      expected_revision: Number(f.get("revision")),
      post_url: url,
    },
  );
  finish(error, "/workspace/drafts");
}
export async function approvedCopy(id: string, revision: number) {
  const { db } = await workspace();
  const { data, error } = await db.rpc("approved_copy", {
    draft: z.uuid().parse(id),
    expected_revision: z.number().int().parse(revision),
  });
  return error ? null : (data as string);
}
