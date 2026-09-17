import "server-only";
import { createHash } from "node:crypto";
import { serviceDatabase } from "@/lib/supabase/server";
export async function allowRequest(
  scope: string,
  identifier: string,
  maximum: number,
  seconds: number,
) {
  const hash = createHash("sha256")
    .update(scope + ":" + identifier)
    .digest("hex");
  const { data, error } = await serviceDatabase().rpc("allow_request", {
    bucket: hash,
    maximum,
    seconds,
  });
  return !error && data === true;
}
