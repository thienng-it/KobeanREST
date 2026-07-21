import { useState, useEffect } from "react";
import { diagnosticMessage } from "../app-utils";
import { checkForUpdates, saveAppSettings, defaultAppSettings } from "../services/local-store";
import { checkForAppUpdate, downloadAndInstallUpdate, type AvailableUpdate } from "../services/updater";
import type { AppSettings, UpdateStatus } from "../types";

export function useAppSettings() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => defaultAppSettings);
  
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    enabled: false,
    lastCheckedLabel: "Automatic checks are off.",
    channel: "stable",
  });
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateProgressLabel, setUpdateProgressLabel] = useState("Signed release metadata is required before install.");
  const [updateToast, setUpdateToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  useEffect(() => {
    if (!updateToast) return;
    const timer = window.setTimeout(() => setUpdateToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [updateToast]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedTheme =
        appSettings.theme === "system"
          ? (mediaQuery.matches ? "dark" : "light")
          : appSettings.theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [appSettings.theme]);

  function updateAppSettings(fields: Partial<AppSettings>) {
    setAppSettings(prev => ({ ...prev, ...fields }));
  }

  async function handleCheckForUpdates(
    trigger: "automatic" | "manual",
    settingsOverride: AppSettings = appSettings,
  ) {
    if (!settingsOverride.updateChecksEnabled && trigger === "automatic") return;

    if (trigger === "manual") {
      setUpdateToast({ message: "Checking for updates...", tone: "info" });
    }

    try {
      const preview = await checkForUpdates();
      if (!preview.releaseReady) {
        setAvailableUpdate(null);
        setUpdateDialogOpen(false);
        setUpdateProgressLabel(preview.message);
        setUpdateStatus({
          enabled: settingsOverride.updateChecksEnabled,
          lastCheckedLabel: preview.message,
          channel: "stable",
        });
        if (trigger === "manual") setUpdateToast({ message: preview.message, tone: "info" });
        return;
      }

      const update = await checkForAppUpdate();
      if (update) {
        setAvailableUpdate(update);
        setUpdateDialogOpen(true);
        setUpdateProgressLabel(`Signed release metadata found for version ${update.version}.`);
        setUpdateStatus({
          enabled: settingsOverride.updateChecksEnabled,
          lastCheckedLabel: `Update ${update.version} is ready to install.`,
          channel: "stable",
        });
        if (trigger === "manual") setUpdateToast(null);
        return;
      }

      setAvailableUpdate(null);
      setUpdateDialogOpen(false);
      setUpdateProgressLabel("No signed updates available.");
      setUpdateStatus({
        enabled: settingsOverride.updateChecksEnabled,
        lastCheckedLabel: "No signed updates available.",
        channel: "stable",
      });
      if (trigger === "manual") {
        setUpdateToast({ message: "You're already on the latest version.", tone: "info" });
      }
    } catch (error) {
      if (trigger === "manual" || settingsOverride.offlineBehavior === "notice") {
        setUpdateDialogOpen(false);
        setUpdateStatus({
          enabled: settingsOverride.updateChecksEnabled,
          lastCheckedLabel: "Update check unavailable. The app remains usable offline.",
          channel: "stable",
        });
        if (trigger === "manual") {
          setUpdateToast({ message: "Update check unavailable. The app remains usable offline.", tone: "error" });
        }
      }
      console.error("Failed to check for updates", diagnosticMessage(error));
    }
  }

  async function handleInstallUpdate() {
    if (!availableUpdate) return;

    setUpdateBusy(true);
    setUpdateProgressLabel("Downloading update...");
    try {
      await downloadAndInstallUpdate(availableUpdate, setUpdateProgressLabel);
      setUpdateStatus((current) => ({
        ...current,
        lastCheckedLabel: "Restart to finish update install.",
      }));
    } catch (error) {
      setUpdateProgressLabel("Update install failed. The app remains usable offline.");
      setUpdateStatus((current) => ({
        ...current,
        lastCheckedLabel: "Update install failed. The app remains usable offline.",
      }));
      console.error("Failed to install update", diagnosticMessage(error));
    } finally {
      setUpdateBusy(false);
    }
  }

  async function handleSaveSettings() {
    try {
      await saveAppSettings(appSettings);
      setUpdateStatus((current) => ({
        ...current,
        enabled: appSettings.updateChecksEnabled,
        lastCheckedLabel: appSettings.updateChecksEnabled
          ? current.lastCheckedLabel
          : "Automatic checks are off.",
      }));
      setSettingsOpen(false);
    } catch (error) {
      console.error("Failed to save settings", diagnosticMessage(error));
      alert("Failed to save settings: " + diagnosticMessage(error));
    }
  }

  return {
    settingsOpen, setSettingsOpen,
    appSettings, setAppSettings, updateAppSettings, handleSaveSettings,
    updateStatus, setUpdateStatus,
    availableUpdate, setAvailableUpdate,
    updateDialogOpen, setUpdateDialogOpen,
    updateBusy, setUpdateBusy,
    updateProgressLabel, setUpdateProgressLabel,
    updateToast, setUpdateToast,
    handleCheckForUpdates, handleInstallUpdate
  };
}
