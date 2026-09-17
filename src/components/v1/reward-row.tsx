import Link from "next/link";
import { Banknote, Laptop, Palmtree, Trophy, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { TeamAvatar } from "./team-avatar";

type Leader = { id: string; name: string; photo?: string; score: number; rank?: number | null };
export function RewardRow({ title, prize, metric, dates, status, leaders, rules, demo = false, error = false, children }: {
  title: string; prize: string; metric: string; dates: string; status: string;
  leaders: Leader[]; rules: string; demo?: boolean; error?: boolean; children?: ReactNode;
}) {
  const theme = /miami|trip|vacation|travel|beach/i.test(prize) ? "escape" : /mac|laptop|computer/i.test(prize) ? "tech" : /\$|cash|dollar/i.test(prize) ? "cash" : "gift";
  const Icon = theme === "escape" ? Palmtree : theme === "tech" ? Laptop : theme === "cash" ? Banknote : Trophy;
  const top = leaders.slice(0, 3);
  const best = Math.max(...leaders.map(p => p.score), 1);
  function standing(person: Leader, index: number) {
    return <li key={person.id} className="reward-standing">
      <span className={index === 0 ? "reward-rank first" : "reward-rank"}>{person.rank ?? index + 1}</span>
      <TeamAvatar name={person.name} src={person.photo} />
      <div className="reward-standing-name"><strong>{person.name}</strong><span className="reward-meter" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, person.score / best * 100))}%` }} /></span></div>
      <strong className="reward-score">{person.score.toLocaleString("en-US")}</strong>
    </li>;
  }
  return <article className={`reward-row reward-${theme}`}>
    <div className="reward-art" aria-hidden="true"><span className="reward-art-orbit" /><Icon strokeWidth={1.3} /><span className="reward-art-label">{theme === "escape" ? "THE GETAWAY" : theme === "tech" ? "THE UPGRADE" : theme === "cash" ? "THE PAYOFF" : "THE PRIZE"}</span></div>
    <div className="reward-story">
      <span className="reward-status"><span />{status}</span>
      <h2 className="reward-prize">{prize}</h2>
      <h3>{title}</h3>
      <p className="reward-goal">Most {metric} wins.</p>
      <small>{dates}</small>
      <Link className="reward-cta" href={demo ? "/demo/ai" : "/workspace/ai"}>Create your next post <ArrowUpRight size={15} /></Link>
    </div>
    <div className="reward-competition">
      <div className="reward-leader-heading"><Trophy size={16} /><h4>{status === "ended" ? "Final leaderboard" : "Leaderboard"}</h4><span>{metric}</span></div>
      {error ? <p>Standings unavailable. Try again later.</p> : top.length ? <ol className="reward-standings">{top.map(standing)}</ol> : <p>No scores yet. Your next post could set the pace.</p>}
      {leaders.length > 3 && <details className="reward-more"><summary>See all {leaders.length} participants</summary><ol className="reward-standings" start={4}>{leaders.slice(3).map((p, i) => standing(p, i + 3))}</ol></details>}
    </div>
    <div className="reward-footer"><details><summary>Prize details & rules</summary><p>{rules}</p><p>{demo ? "Fictional prize and standings. " : ""}The company fulfills this prize outside the app.</p>{children}</details></div>
  </article>;
}
