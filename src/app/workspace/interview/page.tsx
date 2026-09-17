import Link from "next/link";
import { workspace } from "@/lib/supabase/server";
import { interviewQuestion } from "@/lib/ai/interview";
import { startInterview, answerInterview, writePosts } from "./actions";
export default async function Interview({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; notice?: string }>;
}) {
  const { db, member, org } = await workspace();
  const { id, notice } = await searchParams;
  if (!member.opted_in_at)
    return (
      <>
        <h1>Join before you start.</h1>
        <Link href="/workspace/profile">Complete your profile</Link>
      </>
    );
  const { data: interviews } = await db
    .from("interviews")
    .select("*")
    .eq("organization_id", org.id)
    .gte(
      "created_at",
      new Date(new Date().getTime() - 7 * 86400000).toISOString(),
    )
    .order("created_at", { ascending: false });
  const i = interviews?.find((row) => row.id === id);
  return (
    <>
      <h1>There’s a story in your work.</h1>
      <p>
        Answer at least three questions to generate three drafts. Share only
        public-safe information. Answers are saved when you continue and can be
        resumed for seven days.
      </p>
      {notice && (
        <p className="live-notice" role="status">
          {notice === "ai-setup"
            ? "Add ANTHROPIC_API_KEY and ANTHROPIC_MODEL to your hosting settings to enable draft generation."
            : notice === "busy"
              ? "Generation is already running or this interview is complete. Check your drafts."
              : notice === "generation-failed"
                ? "Generation failed safely. Your answers are saved. Check AI setup and try again in five minutes."
                : "Could not save. Refresh to see the latest version."}
        </p>
      )}
      {i ? (
        <>
          <section className="live-card">
            <h2>{i.focus || "Your work story"}</h2>
            {(i.answers as { question: string; answer: string }[]).map(
              (a, n) => (
                <div key={n}>
                  <strong>{a.question}</strong>
                  <p>{a.answer}</p>
                </div>
              ),
            )}
            {!i.generated_at && i.answers.length < 8 && (
              <form action={answerInterview}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="count" value={i.answers.length} />
                <label>
                  {interviewQuestion(
                    i.answers.length,
                    member.job_title,
                    i.focus,
                  )}
                  <textarea name="answer" required maxLength={6000} />
                </label>
                <button className="live-button">
                  Save answer and continue
                </button>
              </form>
            )}
            {!i.generated_at && i.answers.length >= 3 && (
              <form action={writePosts}>
                <input type="hidden" name="id" value={i.id} />
                <button className="live-button secondary">
                  I’m done—write my three drafts
                </button>
              </form>
            )}
            {i.generated_at && (
              <Link href="/workspace/drafts">Your drafts are ready</Link>
            )}
          </section>
        </>
      ) : (
        <form action={startInterview} className="live-card">
          <label>
            What would you like to talk about?
            <input
              name="focus"
              maxLength={500}
              placeholder="A lesson, a better process, or an industry belief"
            />
          </label>
          <button className="live-button">Start my interview</button>
        </form>
      )}
      {!!interviews?.length && (
        <section className="live-card">
          <h2>Recent interviews</h2>
          {interviews.map((row) => (
            <p key={row.id}>
              <Link href={"/workspace/interview?id=" + row.id}>
                {row.focus || "Work story"} · {row.answers.length} answers{" "}
                {row.generated_at ? "· drafts created" : ""}
              </Link>
            </p>
          ))}
        </section>
      )}
    </>
  );
}
