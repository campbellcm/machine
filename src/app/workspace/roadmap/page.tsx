import { implementationStatus } from "@/lib/implementation-status";
export default function Roadmap() {
  return (
    <>
      <h1>What’s ready. What’s next.</h1>
      <p>
        This build establishes the path to a real posting pilot. It is not the
        completed PRD, and configuring accounts does not finish the remaining
        features.
      </p>
      {implementationStatus.map((item) => (
        <section className="live-card" key={item.area}>
          <span className="status">{item.status}</span>
          <h2>{item.area}</h2>
          <p>{item.detail}</p>
        </section>
      ))}
    </>
  );
}
