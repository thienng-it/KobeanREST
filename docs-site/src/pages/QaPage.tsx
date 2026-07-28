import { DocsPageLayout } from "../components/DocsPageLayout";
import { qaContent } from "../content/qa";
import { QaDashboard } from "../components/QaDashboard";

export function QaPage() {
  return (
    <DocsPageLayout content={qaContent}>
      <QaDashboard />
    </DocsPageLayout>
  );
}
