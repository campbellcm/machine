import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { workspace } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { createCampaign, createKey, revokeKeys } from "./actions";
export default async function Campaigns() {
  const { db, org, member } = await workspace();
  if (!["owner", "admin"].includes(member.role)) notFound();
  const { data: campaigns } = await db
    .from("campaigns")
    .select("*")
    .eq("organization_id", org.id);
  const key = (await cookies()).get("crewcast_new_key")?.value;
  return (
    <>
      <h1>See where your posts lead.</h1>
      <form className="live-card" action={createCampaign}>
        <h2>Create a campaign</h2>
        <label>
          Name
          <input name="name" required maxLength={100} />
        </label>
        <label>
          Destination URL
          <input
            name="destination"
            type="url"
            required
            placeholder="https://your-company.com"
          />
        </label>
        <label>
          Campaign tag
          <input name="utm" required maxLength={100} />
        </label>
        <button className="live-button">Create campaign</button>
      </form>
      {campaigns?.map((c) => (
        <section className="live-card" key={c.id}>
          <h2>{c.name}</h2>
          <p>{c.destination_url}</p>
          <small>
            {c.active ? "Active" : "Inactive"} · {c.utm_campaign}
          </small>
        </section>
      ))}
      <section className="live-card">
        <h2>Capture attribution on your website</h2>
        <p>
          Add this script and a hidden input named{" "}
          <code>crewcast_click_id</code> to your lead form. Your server can
          forward that ID through the conversion endpoint.
        </p>
        <pre>{`<script src="${appUrl()}/snippet.js" defer></script>\n<input type="hidden" name="crewcast_click_id" />`}</pre>
        <small>
          Set VISITOR_HASH_SALT to a random secret before collecting clicks.
          Review your website’s cookie notice before enabling attribution.
        </small>
      </section>
      <section className="live-card">
        <h2>Conversion API keys</h2>
        <p>
          Keep keys on your server. Never embed one in your website’s
          JavaScript.
        </p>
        {key && (
          <>
            <p>
              Copy your new key now. It is shown briefly here and stored only as
              a hash in the database.
            </p>
            <input aria-label="New conversion API key" readOnly value={key} />
          </>
        )}
        <form action={createKey}>
          <button className="live-button">Create server API key</button>
        </form>
        <form action={revokeKeys}>
          <button className="live-button secondary">
            Revoke all company API keys
          </button>
        </form>
        <pre>{`POST ${appUrl()}/api/v1/conversions\nAuthorization: Bearer YOUR_SERVER_KEY\nContent-Type: application/json\n\n{"type":"lead","external_id":"your-unique-event-id","click_id":"CAPTURED_CLICK_UUID"}`}</pre>
        <p>
          Events without an eligible click are recorded as unattributed.
          Repeating an event ID does not create a second conversion.
        </p>
      </section>
    </>
  );
}
