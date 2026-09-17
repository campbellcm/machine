export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
export default function Home() {
  redirect(supabaseConfig() ? "/workspace" : "/setup");
}
