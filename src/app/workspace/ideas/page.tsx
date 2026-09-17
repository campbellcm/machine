import { curatedIdeas } from "@/lib/ai/ideas";
import { startInterview } from "../interview/actions";
export default function Ideas() {
  return (
    <>
      <h1>You already have something to say.</h1>
      <p>
        Forty starting points from everyday work. Choose one grounded in your
        own experience.
      </p>
      <div className="live-grid">
        {curatedIdeas.map((idea) => (
          <form key={idea.id} action={startInterview} className="live-card">
            <span className="eyebrow">{idea.role}</span>
            <h2>{idea.prompt}</h2>
            <input type="hidden" name="focus" value={idea.prompt} />
            <button className="live-button secondary">
              Start an interview
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
