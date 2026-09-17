import { NextResponse } from "next/server";
import { workspace } from "@/lib/supabase/server";
import { toCsv } from "@/lib/tracking/csv";
export async function GET() {
  const { db, org, member } = await workspace();
  if (!["owner", "admin", "viewer"].includes(member.role))
    return new NextResponse("Not found", { status: 404 });
  const { data: team, error } = await db
    .from("memberships")
    .select("display_name,job_title,department,role,opted_in_at,removed_at")
    .eq("organization_id", org.id)
    .limit(1000);
  if (error) return new NextResponse("Export unavailable", { status: 503 });
  return new NextResponse(
    toCsv([
      ["Name", "Title", "Department", "Role", "Opted in", "Status"],
      ...(team || []).map((m) => [
        m.removed_at ? "Former teammate" : m.display_name,
        m.removed_at ? "" : m.job_title,
        m.department,
        m.role,
        m.opted_in_at ? "Yes" : "No",
        m.removed_at ? "Removed" : "Active",
      ]),
    ]),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="team.csv"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
