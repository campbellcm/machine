import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404 · Page not found</p>
      <h1>Let’s get you back.</h1>
      <p>This page isn’t part of the demo workspace.</p>
      <Link className="button button-primary" href="/demo">
        Back to overview
      </Link>
    </main>
  );
}
