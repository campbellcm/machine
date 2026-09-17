"use server";
import { allowRequest } from "@/lib/security/rate-limit";
import { z } from "zod";
import { redirect } from "next/navigation";
import { workspace, serviceDatabase } from "@/lib/supabase/server";
import { generateDrafts } from "@/lib/ai/generate";
import { interviewQuestion } from "@/lib/ai/interview";
export async function startInterview(f: FormData) {
  const { db, org } = await workspace();
  const { data, error } = await db.rpc("save_interview", {
    org: org.id,
    interview: null,
    topic: z
      .string()
      .max(500)
      .parse(f.get("focus") || ""),
    question: "",
    answer: "",
    expected_answers: 0,
  });
  redirect(
    error
      ? "/workspace/interview?notice=failed"
      : "/workspace/interview?id=" + data,
  );
}
export async function answerInterview(f: FormData) {
  const { db, org, member } = await workspace();
  const id = z.uuid().parse(f.get("id"));
  const { data: i } = await db
    .from("interviews")
    .select("*")
    .eq("id", id)
    .single();
  if (!i) redirect("/workspace/interview?notice=failed");
  const { error } = await db.rpc("save_interview", {
    org: org.id,
    interview: id,
    topic: i.focus,
    question: interviewQuestion(i.answers.length, member.job_title, i.focus),
    answer: z.string().trim().min(1).max(6000).parse(f.get("answer")),
    expected_answers: Number(f.get("count")),
  });
  redirect("/workspace/interview?id=" + id + (error ? "&notice=failed" : ""));
}
export async function writePosts(f: FormData) {
  const { db, org, member } = await workspace();
  const id = z.uuid().parse(f.get("id"));
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ANTHROPIC_MODEL)
    redirect("/workspace/interview?id=" + id + "&notice=ai-setup");
  const { data: i } = await db
    .from("interviews")
    .select("*")
    .eq("id", id)
    .single();
  if (!i) redirect("/workspace/interview?notice=failed");
  if (!(await allowRequest("ai-generation", member.user_id, 10, 3600)))
    redirect("/workspace/interview?id=" + id + "&notice=busy");
  const { data: claimed } = await db.rpc("claim_generation", { interview: id });
  if (!claimed) redirect("/workspace/interview?id=" + id + "&notice=busy");
  let success = false;
  try {
    const answers = z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .min(3)
      .max(8)
      .parse(i.answers);
    const drafts = await generateDrafts({
      company: org.name,
      context: org.context,
      voice: org.voice,
      blocked: org.blocked_phrases,
      role: member.job_title,
      topics: member.topics,
      focus: i.focus,
      answers,
    });
    const { error } = await serviceDatabase().rpc("complete_generation", {
      interview: id,
      items: drafts,
    });
    success = !error;
  } catch {
    /* Never log source material or model output. */
  }
  redirect(
    success
      ? "/workspace/drafts?notice=saved"
      : "/workspace/interview?id=" + id + "&notice=generation-failed",
  );
}
