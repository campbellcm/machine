import { notFound } from "next/navigation";
import {
  ContentLibrary,
  Team,
  Ideas,
  Settings,
  Roadmap,
} from "@/components/workspace-pages";
import { CallStories } from "@/components/calls/call-stories";
const pages = {
  calls: CallStories,
  content: ContentLibrary,
  team: Team,
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
