import { Download, History, RefreshCw, Settings } from "lucide-react";

export interface TopbarProps {
  onOpenDocs: () => void;
  onOpenHistory: () => void;
  onCheckForUpdates: () => void;
  onOpenSettings: () => void;
}

export function Topbar({
  onOpenDocs,
  onOpenHistory,
  onCheckForUpdates,
  onOpenSettings,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-actions">
        <button className="ghost-button" type="button" onClick={onOpenDocs}>
          <Download size={16} />
          Docs
        </button>
        <button
          className="ghost-button"
          type="button"
          aria-label="Open request history"
          onClick={onOpenHistory}
        >
          <History size={16} />
          History
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={onCheckForUpdates}
        >
          <RefreshCw size={16} />
          Check updates
        </button>
        <button
          className="icon-button"
          aria-label="Settings"
          type="button"
          onClick={onOpenSettings}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
