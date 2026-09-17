import { ContentEngine } from "@/components/content-engine/content-engine";
import { contentDemo } from "@/lib/content-engine/demo";
export default function AI() {
  return <ContentEngine data={contentDemo()} demo />;
}
