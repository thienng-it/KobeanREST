import type { DocsSection } from "../content/shared";

interface SectionNavProps {
  sections: DocsSection[];
}

export function SectionNav({ sections }: SectionNavProps) {
  return (
    <nav className="section-nav" aria-label="Page sections">
      <span>On this page</span>
      {sections.map((section) => (
        <a key={section.id} href={`#${section.id}`}>
          {section.title}
        </a>
      ))}
    </nav>
  );
}
