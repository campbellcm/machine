"use client";
import { useState } from "react";

export function TeamAvatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  const safe = src?.startsWith("https://") ? src : null;
  return <span className="team-avatar" aria-hidden="true">
    {safe && failed !== safe ? (
      // User-supplied images load directly, without a server-side image proxy.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={safe} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(safe)} />
    ) : name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?"}
  </span>;
}
