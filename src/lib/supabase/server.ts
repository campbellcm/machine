import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseConfig } from "./config";
export async function database() {
  const config = supabaseConfig();
  if (!config) redirect("/setup");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server components rely on proxy refresh. */
        }
      },
    },
  });
}
export async function signedIn() {
  const db = await database();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) redirect("/login");
  return { db, user: data.user };
}
export function serviceDatabase() {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) throw new Error("Database service setup required");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function workspace() {
  const { db, user } = await signedIn();
  const selected = (await cookies()).get("crewcast_org")?.value;
  const { data: members, error } = await db
    .from("memberships")
    .select("*,organizations(name)")
    .eq("user_id", user.id)
    .is("removed_at", null);
  if (error) redirect("/setup?issue=database");
  const member =
    members?.find((m) => m.organization_id === selected) || members?.[0];
  if (!member) redirect("/onboarding");
  const { data: org } = await db
    .from("organizations")
    .select("*")
    .eq("id", member.organization_id)
    .single();
  if (!org) redirect("/setup?issue=database");
  return { db, user, member, org, members: members! };
}
