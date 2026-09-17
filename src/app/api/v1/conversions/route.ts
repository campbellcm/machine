import { boundedJson } from "@/lib/security/body";
import { allowRequest } from "@/lib/security/rate-limit";
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceDatabase } from "@/lib/supabase/server";
const eventSchema = z
  .object({
    click_id: z.uuid().optional(),
    type: z.enum(["lead", "demo_booked", "signup", "custom"]),
    external_id: z.string().min(1).max(200),
    occurred_at: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 8192)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token || !/^cc_[A-Za-z0-9_-]{43}$/.test(token))
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  try {
    const db = serviceDatabase();
    const { data: key } = await db
      .from("api_keys")
      .select("organization_id")
      .eq("key_hash", createHash("sha256").update(token).digest("hex"))
      .is("revoked_at", null)
      .single();
    if (!key)
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    if (!(await allowRequest("conversions", key.organization_id, 120, 60)))
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    const event = await boundedJson(request, eventSchema);
    const { data: created, error } = await db.rpc("record_conversion", {
      org: key.organization_id,
      click: event.click_id || null,
      event_type: event.type,
      event_id: event.external_id,
      event_time: event.occurred_at || new Date().toISOString(),
    });
    if (error)
      return NextResponse.json(
        { error: "Conversion could not be recorded" },
        { status: 400 },
      );
    return NextResponse.json(
      { created: !!created },
      { status: created ? 201 : 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Conversion service unavailable or invalid request" },
      { status: 400 },
    );
  }
}
