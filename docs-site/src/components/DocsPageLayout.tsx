import { SectionNav } from "./SectionNav";
import type { DocsPageContent } from "../content/shared";

interface DocsPageLayoutProps {
  content: DocsPageContent;
}

export function DocsPageLayout({ content }: DocsPageLayoutProps) {
  return (
    <article className="docs-page">
      <header className="docs-hero">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </header>

      <div className="docs-grid">
        <SectionNav sections={content.sections} />
        <div className="docs-sections">
          {content.sections.map((section) => (
            <section className="doc-section glass-panel" id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.intro ? <p>{section.intro}</p> : null}
              {section.body ? <div className="section-body">{section.body}</div> : null}
              {section.items ? (
                <ul className="check-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
