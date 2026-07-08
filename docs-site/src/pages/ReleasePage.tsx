import { DocsPageLayout } from "../components/DocsPageLayout";
import { releaseContent } from "../content/release";

export function ReleasePage() {
  return <DocsPageLayout content={releaseContent} />;
}
