"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section>
      <h1>Your content is temporarily unavailable.</h1>
      <p>Your saved work is safe. Try loading it again.</p>
      <button className="live-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
