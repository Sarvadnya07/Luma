import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Database,
  Activity,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  Download,
} from "lucide-react";
import { LumaApi } from "../../lib/tauri";
import { DiagnosticsReport, MaintenanceResult, BackupRecord } from "@luma/shared-types";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

type TabKey = "general" | "maintenance" | "diagnostics" | "backup";

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);

  // Backups State
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  // Maintenance State
  const [maintenanceLog, setMaintenanceLog] = useState<MaintenanceResult[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === "diagnostics") {
        void loadDiagnostics();
      } else if (activeTab === "backup") {
        void loadBackups();
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const loadDiagnostics = async () => {
    setIsLoading(true);
    try {
      const res = await LumaApi.runDiagnostics();
      setDiagnostics(res);
    } catch (err) {
      setStatusMessage(`Failed to run diagnostics: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const list = await LumaApi.listBackups();
      setBackups(list);
    } catch (err) {
      setStatusMessage(`Failed to list backups: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const b = await LumaApi.createBackup(`Luma_Manual_Backup_${Date.now()}`);
      setStatusMessage(`Backup created successfully: ${b.backup_name} (${Math.round(b.file_size_bytes / 1024)} KB)`);
      await loadBackups();
    } catch (err) {
      setStatusMessage(`Failed to create backup: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunMaintenance = async (op: "reconcile" | "rebuild_fts" | "clean_cache" | "vacuum") => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      let res: MaintenanceResult;
      if (op === "reconcile") {
        res = await LumaApi.maintenanceReconcileFiles();
      } else if (op === "rebuild_fts") {
        res = await LumaApi.maintenanceRebuildSearchIndex();
      } else if (op === "clean_cache") {
        res = await LumaApi.maintenanceCleanupCaches();
      } else {
        res = await LumaApi.maintenanceVacuumDatabase();
      }
      setMaintenanceLog((prev) => [res, ...prev]);
      setStatusMessage(`Maintenance: ${res.message} (${res.duration_ms}ms)`);
    } catch (err) {
      setStatusMessage(`Maintenance failed: ${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl bg-[#FAF7F2] dark:bg-[#1E1C1A] border border-[#DDD5C7] dark:border-[#38332E] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#1C1917] dark:text-[#F5F1EA]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3] dark:border-[#332E2A]">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#8C8275]" />
            <h2 className="font-serif text-lg font-bold">Luma System & Preferences</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#78716C] hover:text-[#18181B] dark:hover:text-white hover:bg-[#EFEAE1] dark:hover:bg-[#2D2824] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E5DFD3] dark:border-[#332E2A] px-6 bg-[#F3EFE6] dark:bg-[#181614] text-xs font-medium text-[#78716C] dark:text-[#A89F91]">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "general"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#1C1917] dark:text-white font-semibold"
                : "border-transparent hover:text-[#1C1917] dark:hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            General
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "maintenance"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#1C1917] dark:text-white font-semibold"
                : "border-transparent hover:text-[#1C1917] dark:hover:text-white"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Maintenance
          </button>
          <button
            onClick={() => setActiveTab("diagnostics")}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "diagnostics"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#1C1917] dark:text-white font-semibold"
                : "border-transparent hover:text-[#1C1917] dark:hover:text-white"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Diagnostics
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "backup"
                ? "border-[#18181B] dark:border-[#F5F1EA] text-[#1C1917] dark:text-white font-semibold"
                : "border-transparent hover:text-[#1C1917] dark:hover:text-white"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Backups
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statusMessage && (
            <div className="p-3 rounded-lg bg-[#EAE4DA] dark:bg-[#2A2622] text-xs font-medium border border-[#DDD5C7] dark:border-[#403B35] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E]">
                <div>
                  <h4 className="text-xs font-bold">Color Theme</h4>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91]">
                    Toggle between Sanctuary Light and Obsidian Dark theme
                  </p>
                </div>
                <button
                  onClick={onToggleDarkMode}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#18181B] hover:bg-[#27272A] text-white dark:bg-[#FAF7F2] dark:text-[#18181B] transition-colors"
                >
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] space-y-2">
                <h4 className="text-xs font-bold">Local-First Storage Invariant</h4>
                <p className="text-xs text-[#57534E] dark:text-[#C7BEB2] leading-relaxed">
                  Luma is strictly local-first. All your books, reading positions, bookmarks, notes,
                  and highlights are stored in an embedded, zero-cloud SQLite database inside your
                  application data directory.
                </p>
              </div>
            </div>
          )}

          {/* MAINTENANCE TAB */}
          {activeTab === "maintenance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  disabled={isLoading}
                  onClick={() => handleRunMaintenance("reconcile")}
                  className="p-4 text-left rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] hover:border-[#8C8275] transition-all"
                >
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                    Reconcile Files
                  </h4>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91] mt-1">
                    Verify that all cataloged files exist on disk.
                  </p>
                </button>

                <button
                  disabled={isLoading}
                  onClick={() => handleRunMaintenance("rebuild_fts")}
                  className="p-4 text-left rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] hover:border-[#8C8275] transition-all"
                >
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-purple-600" />
                    Rebuild FTS Search
                  </h4>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91] mt-1">
                    Re-index library publications in SQLite FTS5.
                  </p>
                </button>

                <button
                  disabled={isLoading}
                  onClick={() => handleRunMaintenance("clean_cache")}
                  className="p-4 text-left rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] hover:border-[#8C8275] transition-all"
                >
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-amber-600" />
                    Clean Staging Caches
                  </h4>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91] mt-1">
                    Remove temporary uncompressed EPUB artifacts.
                  </p>
                </button>

                <button
                  disabled={isLoading}
                  onClick={() => handleRunMaintenance("vacuum")}
                  className="p-4 text-left rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] hover:border-[#8C8275] transition-all"
                >
                  <h4 className="text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Vacuum SQLite DB
                  </h4>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91] mt-1">
                    Optimize storage and reclaim free database pages.
                  </p>
                </button>
              </div>

              {maintenanceLog.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h5 className="text-xs font-bold text-[#78716C]">Maintenance History</h5>
                  <div className="space-y-1 text-xs font-mono">
                    {maintenanceLog.map((log, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] flex justify-between"
                      >
                        <span>{log.message}</span>
                        <span className="text-[#78716C]">{log.duration_ms}ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DIAGNOSTICS TAB */}
          {activeTab === "diagnostics" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold">Subsystem Health Status</span>
                <button
                  disabled={isLoading}
                  onClick={loadDiagnostics}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EAE4DA] dark:bg-[#2A2622] hover:bg-[#DDD5C7] dark:hover:bg-[#38332E] transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>

              {diagnostics ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] flex items-center justify-between">
                    <span className="text-xs font-medium">Overall System Health</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {diagnostics.overall_status.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {diagnostics.subsystems.map((sub, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-semibold">{sub.name}</div>
                          <div className="text-[10px] text-[#78716C] dark:text-[#A89F91]">
                            {sub.details || "Operating normally"}
                          </div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-[#78716C]">
                  {isLoading ? "Running system diagnostics..." : "Click Refresh to inspect subsystems"}
                </div>
              )}
            </div>
          )}

          {/* BACKUPS TAB */}
          {activeTab === "backup" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-bold">Snapshots & Backups</h4>
                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91]">
                    Create instant snapshots of your entire library and annotations
                  </p>
                </div>
                <button
                  disabled={isLoading}
                  onClick={handleCreateBackup}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#18181B] hover:bg-[#27272A] text-white dark:bg-[#FAF7F2] dark:text-[#18181B] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Create Snapshot
                </button>
              </div>

              <div className="space-y-2">
                {backups.length > 0 ? (
                  backups.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-white dark:bg-[#24211E] border border-[#E5DFD3] dark:border-[#38332E] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold block">{b.backup_name}</span>
                        <span className="text-[10px] text-[#78716C] font-mono">
                          {b.books_count} books • {b.annotations_count} annotations • {Math.round(b.file_size_bytes / 1024)} KB
                        </span>
                      </div>
                      <span className="text-[10px] text-[#78716C]">
                        {new Date(b.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-xs text-[#78716C] border border-dashed border-[#DDD5C7] dark:border-[#38332E] rounded-xl">
                    No snapshots found. Click "Create Snapshot" to create your first backup.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E5DFD3] dark:border-[#332E2A] flex justify-end bg-[#F3EFE6] dark:bg-[#181614]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#18181B] hover:bg-[#27272A] text-white dark:bg-[#FAF7F2] dark:text-[#18181B] text-xs font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
