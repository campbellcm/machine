"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <section className="live-card" role="alert">
      <h1>That action couldn’t finish.</h1>
      <p>
        Your saved work is still in the workspace. Check your entries and try
        again. If this continues, ask your administrator to check service setup.
      </p>
      <button className="live-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
