import { useState } from "react";
import { loadHistory, clearHistory } from "../services/local-store";
import { diagnosticMessage } from "../app-utils";
import type { HistoryEntry, WorkspaceSummary } from "../types";

export function useHistory(
  workspace: WorkspaceSummary | null,
  setSelectedRequestId: (id: string) => void
) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  async function handleOpenHistory() {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const entries = await loadHistory();
      setHistoryEntries(entries);
    } catch (err) {
      console.error("Failed to load history", diagnosticMessage(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleClearHistory() {
    try {
      await clearHistory();
      setHistoryEntries([]);
    } catch (err) {
      console.error("Failed to clear history", diagnosticMessage(err));
    }
  }

  function handleReplayFromHistory(entry: HistoryEntry) {
    if (!workspace) return;
    const exists = workspace.requests.some(r => r.id === entry.requestId);
    if (exists) {
      setSelectedRequestId(entry.requestId);
      setHistoryOpen(false);
    }
  }

  return {
    historyOpen, setHistoryOpen,
    historyEntries, setHistoryEntries,
    historySearch, setHistorySearch,
    historyLoading, setHistoryLoading,
    handleOpenHistory,
    handleClearHistory,
    handleReplayFromHistory,
  };
}
