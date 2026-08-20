import { Download, History, RefreshCw, Settings } from "lucide-react";
import { useI18n } from '../services/i18n';
import { PositiveQuoteWidget } from "./PositiveQuoteWidget";

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
  const { t } = useI18n();
  return (
    <header className="topbar">
      <PositiveQuoteWidget />
      <div className="topbar-actions">
        <button className="ghost-button" type="button" onClick={onOpenDocs}>
          <Download size={16} />
          {t('nav.docs')}
        </button>
        <button
          className="ghost-button"
          type="button"
          aria-label={t('topbar.historyAria')}
          onClick={onOpenHistory}
        >
          <History size={16} />
          {t('nav.history')}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={onCheckForUpdates}
        >
          <RefreshCw size={16} />
          {t('topbar.checkUpdates')}
        </button>
        <button
          className="icon-button"
          aria-label={t('nav.settings')}
          type="button"
          onClick={onOpenSettings}
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
