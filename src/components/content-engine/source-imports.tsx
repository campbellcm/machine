import { workspace } from "@/lib/supabase/server";
import { sourceSlackConfig } from "@/lib/sources/slack";
import {
  connectFathom,
  importSource,
  approveImport,
  disconnectSource,
} from "@/lib/sources/actions";
export async function SourceImports() {
  const { db, org } = await workspace();
  // Request-time expiry boundary for private staging.
  // eslint-disable-next-line react-hooks/purity
  const freshSince = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: connections, error }, { data: items }] = await Promise.all([
    db.rpc("source_connection_status", { org: org.id }),
    db
      .from("source_imports")
      .select("id,provider,title,content,created_at")
      .eq("organization_id", org.id)
      .is("source_id", null)
      .gte("created_at", freshSince)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const statuses = (connections || []) as {
    provider: string;
    expired: boolean | null;
  }[];
  return (
    <details className="live-card">
      <summary>Turn selected work into content</summary>
      <p>
        Import one Fathom recording or selected public-channel Slack message.
        Only you can review the imported text. Nothing goes to AI until you edit
        and approve it below.
      </p>
      {error && (
        <p>
          Import setup is unavailable. Apply the latest database migrations.
        </p>
      )}
      <h2>Fathom</h2>
      {statuses.some((s) => s.provider === "fathom") ? (
        <p>Key saved. Access is verified when you import a recording.</p>
      ) : (
        <form action={connectFathom}>
          <label>
            Your Fathom API key
            <input
              name="token"
              type="password"
              autoComplete="off"
              required
              minLength={10}
              maxLength={500}
            />
          </label>
          <label>
            <input type="checkbox" name="confirmed" required />
            This is my authorized Fathom key. Store it encrypted for recordings
            I choose to import.
          </label>
          <button className="live-button secondary">Save Fathom key</button>
          <p>
            Create a key in Fathom User Settings → API Access. Never paste it in
            a post or chat.
          </p>
        </form>
      )}
      <h2>Slack source access</h2>
      {statuses.some((s) => s.provider === "slack" && !s.expired) ? (
        <p>Connected for selected public-channel messages.</p>
      ) : sourceSlackConfig() ? (
        <form action="/api/sources/slack/connect" method="post">
          <p>
            This separate connection requests user access to public-channel
            history. Crewcast fetches only a message you select; it does not
            read private channels, DMs or replies automatically.
          </p>
          <button className="live-button secondary">
            Connect Slack sources
          </button>
        </form>
      ) : (
        <p>
          Ask your admin to configure the Slack source callback and
          channels:history and channels:read user scope in Setup.
        </p>
      )}
      {statuses.map((s) => (
        <section key={s.provider} className="live-card">
          <form action={importSource}>
            <input type="hidden" name="provider" value={s.provider} />
            <label>
              {s.provider === "fathom"
                ? "Fathom recording ID"
                : "Slack message link"}
              <input
                name="reference"
                required
                maxLength={1000}
                placeholder={
                  s.provider === "fathom"
                    ? "123456789"
                    : "https://your-team.slack.com/archives/C…/p…"
                }
              />
            </label>
            <label>
              <input type="checkbox" name="permission" required />I have
              permission to import this material for private review.
            </label>
            <button className="live-button secondary">
              Import for my review
            </button>
          </form>
          <form action={disconnectSource}>
            <input type="hidden" name="provider" value={s.provider} />
            <p>
              Disconnecting removes this connection and its imported sources,
              invalidating dependent drafts.
            </p>
            <button className="live-button secondary">
              Disconnect {s.provider}
            </button>
          </form>
        </section>
      ))}
      <p>
        One import per minute. For transcripts over 16,000 characters, use a
        selected approved excerpt in Sources. Speaker metadata is discarded and
        common identifiers are redacted, but you must still remove names,
        confidential company details and unsupported claims.
      </p>
      {items?.map((item) => (
        <form key={item.id} action={approveImport} className="live-card">
          <h3>Review {item.provider} material</h3>
          <input type="hidden" name="id" value={item.id} />
          <label>
            Keep only material you can use externally
            <textarea
              name="content"
              required
              minLength={30}
              maxLength={16000}
              rows={8}
              defaultValue={item.content}
            />
          </label>
          <label>
            Allowed use
            <select name="usage">
              <option value="inspiration_only">General inspiration only</option>
              <option value="approved_fact">Approved facts</option>
            </select>
          </label>
          <label>
            <input type="checkbox" name="approved" required />I have permission
            for this use and removed confidential, personal and
            customer-identifying details. Send this edited text to our
            configured AI provider.
          </label>
          <button className="live-button">Approve edited source</button>
        </form>
      ))}
      <p>
        Unapproved imports expire after seven days. Approved private sources
        expire within 30 days. Delete them sooner in Sources or disconnect the
        provider. Permissions are checked at import time; revoke content here if
        your permission changes.
      </p>
    </details>
  );
}
