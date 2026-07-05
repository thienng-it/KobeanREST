import { DocsPageLayout } from "../components/DocsPageLayout";
import { productContent } from "../content/product";

export function ProductPage() {
  return <DocsPageLayout content={productContent} />;
}
