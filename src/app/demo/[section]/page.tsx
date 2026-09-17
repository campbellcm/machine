import { notFound } from "next/navigation";
import {
  ContentLibrary,
  Ideas,
  Settings,
  Roadmap,
} from "@/components/workspace-pages";
import { CallStories } from "@/components/calls/call-stories";
import { DemoTeam, DemoRewards, DemoAI } from "@/components/v1/demo-pages";
const pages = {
  rewards: DemoRewards,
  ai: DemoAI,
  calls: CallStories,
  content: ContentLibrary,
  team: DemoTeam,
  ideas: Ideas,
  settings: Settings,
  roadmap: Roadmap,
};
export function generateStaticParams() {
  return Object.keys(pages).map((section) => ({ section }));
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!(section in pages)) notFound();
  const Page = pages[section as keyof typeof pages];
  return <Page />;
}
