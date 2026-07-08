import type { LucideIcon } from "lucide-react";

interface PortalCardProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PortalCard({ href, title, description, icon: Icon }: PortalCardProps) {
  return (
    <a className="portal-card glass-panel" href={href}>
      <span className="portal-card-icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span>
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
    </a>
  );
}
