"use client";
import { useState } from "react";
import { approvedCopy } from "@/app/workspace/actions";
export function CopyPost({ id, revision }: { id: string; revision: number }) {
  const [status, setStatus] = useState("");
  return (
    <>
      <button
        className="live-button secondary"
        onClick={async () => {
          const result = await approvedCopy(id, revision);
          if (!result) {
            setStatus(
              "This draft changed or needs approval again. Refresh before copying.",
            );
            return;
          }
          try {
            await navigator.clipboard.writeText(result);
            setStatus("Copied. Open LinkedIn and paste your post.");
          } catch {
            setStatus(
              "Copy was blocked. Select and copy the approved text above.",
            );
          }
        }}
      >
        Copy approved post
      </button>
      <a
        className="live-button secondary"
        href="https://www.linkedin.com/feed/"
        target="_blank"
        rel="noreferrer"
      >
        Open LinkedIn ↗
      </a>
      <small role="status">{status}</small>
    </>
  );
}
