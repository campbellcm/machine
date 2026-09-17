import { notFound } from "next/navigation";
import { workspace } from "@/lib/supabase/server";
export default async function Audit() {
  const { db, org, member } = await workspace();
  if (!["owner", "admin"].includes(member.role)) notFound();
  const { data: events } = await db
    .from("audit_log")
    .select("*")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <>
      <h1>Workspace activity.</h1>
      <p>
        The latest 100 recorded settings, review, connection, and publishing
        events. No post content or tokens appear here.
      </p>
      {events?.map((event) => (
        <section className="live-card" key={event.id}>
          <strong>{event.action}</strong>
          <p>
            {new Date(event.created_at).toLocaleString("en-US", {
              timeZone: org.timezone,
            })}
          </p>
          <small>
            Actor: {event.actor_user_id || "System"}
            {event.target_id ? " · Record: " + event.target_id : ""}
          </small>
        </section>
      ))}
    </>
  );
}
