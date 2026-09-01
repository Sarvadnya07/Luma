import React, { useState, useCallback } from "react";
import {
  Laptop,
  Tablet,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  Check,
  Loader2,
} from "lucide-react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Device {
  id: string;
  name: string;
  type: "laptop" | "tablet" | "ereader" | "phone";
  model?: string;
  version: string; // e.g., "Luma Desktop v1.4.1"
  status: "synced" | "syncing" | "offline" | "error";
  lastSynced?: string; // ISO date string
  storageUsed?: string; // e.g., "24 GB"
  storageTotal?: string; // e.g., "512 GB"
  battery?: number; // percentage
  metadata?: Record<string, any>;
}

export interface SyncConflict {
  id: string;
  bookTitle: string;
  bookAuthor?: string;
  description: string;
  options: {
    deviceId: string;
    deviceName: string;
    deviceType: Device["type"];
    progress: string; // e.g., "Page 442 (Chapter 16)"
    timestamp: string; // ISO date string
  }[];
}

export interface SyncDeviceCenterProps {
  devices: Device[];
  conflict?: SyncConflict | null;
  loading?: boolean;
  onSyncAll?: () => void;
  onSyncDevice?: (deviceId: string) => void;
  onManageDevice?: (deviceId: string) => void;
  onWakeDevice?: (deviceId: string) => void;
  onResolveConflict?: (conflictId: string, chosenDeviceId: string) => void;
  footerText?: string;
  footerLinks?: { label: string; href: string }[];
}

// ------------------------------------------------------------------
// Sub‑component: DeviceCard
// ------------------------------------------------------------------

interface DeviceCardProps {
  device: Device;
  onSync: (id: string) => void;
  onManage: (id: string) => void;
  onWake: (id: string) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onSync, onManage, onWake }) => {
  const IconMap: Record<Device["type"], React.ElementType> = {
    laptop: Laptop,
    tablet: Tablet,
    ereader: Smartphone,
    phone: Smartphone,
  };
  const Icon = IconMap[device.type] || Laptop;

  const statusConfig = {
    synced: { label: "Synced just now", color: "emerald", dot: "bg-emerald-600" },
    syncing: { label: "Syncing...", color: "amber", dot: "bg-amber-500 animate-pulse" },
    offline: { label: "Offline", color: "gray", dot: "bg-gray-400" },
    error: { label: "Sync error", color: "rose", dot: "bg-rose-500" },
  };
  const status = statusConfig[device.status] || statusConfig.offline;
  const lastSynced = device.lastSynced
    ? new Date(device.lastSynced).toLocaleString()
    : "Never";

  return (
    <div className="bg-white border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs flex items-center justify-between">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-[#1C1917]" />
        </div>
        <div className="space-y-1">
          <h4 className="font-serif text-sm font-bold text-[#1C1917]">
            {device.name}
            {device.model && <span className="font-mono text-[11px] text-[#78716C] ml-1">({device.model})</span>}
          </h4>
          <p className="text-[11px] text-[#78716C] font-mono">{device.version}</p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            <span className={device.status === "synced" ? "text-emerald-700" : "text-[#78716C]"}>
              {status.label}
            </span>
            {device.status !== "offline" && device.status !== "error" && (
              <span className="text-[#78716C] font-normal">• {lastSynced}</span>
            )}
            {device.status === "offline" && (
              <WifiOff className="w-3 h-3 text-[#A8A29E]" />
            )}
          </div>
        </div>
      </div>

      <div className="text-right space-y-2">
        {device.storageUsed && device.storageTotal && (
          <span className="text-[11px] text-[#78716C] block font-mono">
            Storage: {device.storageUsed} / {device.storageTotal}
          </span>
        )}
        {device.battery !== undefined && (
          <span className="text-[11px] text-[#78716C] block font-mono">
            Battery: {device.battery}%
          </span>
        )}
        <div className="flex justify-end gap-2">
          {device.status === "offline" ? (
            <button
              onClick={() => onWake(device.id)}
              className="text-xs text-[#78716C] hover:text-[#18181B] font-semibold"
            >
              Wake
            </button>
          ) : (
            <>
              <button
                onClick={() => onManage(device.id)}
                className="text-xs text-[#1C1917] hover:underline font-semibold"
              >
                Manage
              </button>
              {device.status !== "synced" && (
                <button
                  onClick={() => onSync(device.id)}
                  className="py-1 px-2.5 bg-[#FAF7F2] border border-[#DDD5C7] hover:bg-[#EFEAE1] text-xs font-semibold text-[#1C1917] rounded-lg transition-colors"
                >
                  Sync Now
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// Sub‑component: ConflictCard
// ------------------------------------------------------------------

interface ConflictCardProps {
  conflict: SyncConflict;
  onResolve: (conflictId: string, chosenDeviceId: string) => void;
}

const ConflictCard: React.FC<ConflictCardProps> = ({ conflict, onResolve }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    conflict.options[0]?.deviceId || ""
  );
  const [isResolved, setIsResolved] = useState(false);

  const handleResolve = useCallback(() => {
    if (selectedDeviceId) {
      onResolve(conflict.id, selectedDeviceId);
      setIsResolved(true);
    }
  }, [conflict.id, selectedDeviceId, onResolve]);

  const IconMap: Record<Device["type"], React.ElementType> = {
    laptop: Laptop,
    tablet: Tablet,
    ereader: Smartphone,
    phone: Smartphone,
  };

  return (
    <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
          <span>Sync Conflict</span>
        </div>
        <span className="text-[10px] text-amber-700 font-mono">1 unresolved</span>
      </div>

      <div className="space-y-1">
        <h4 className="font-serif text-sm font-bold text-[#1C1917]">
          {conflict.bookTitle}
          {conflict.bookAuthor && (
            <span className="font-sans text-xs font-normal text-[#78716C] ml-1">
              by {conflict.bookAuthor}
            </span>
          )}
        </h4>
        <p className="text-xs text-[#78716C]">{conflict.description}</p>
      </div>

      <div className="space-y-2 text-xs">
        {conflict.options.map((opt) => {
          const Icon = IconMap[opt.deviceType] || Laptop;
          const isSelected = selectedDeviceId === opt.deviceId;
          return (
            <div
              key={opt.deviceId}
              onClick={() => !isResolved && setSelectedDeviceId(opt.deviceId)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected
                  ? "bg-teal-50/50 border-teal-600 ring-1 ring-teal-600"
                  : "bg-[#FAF7F2] border-[#E5DFD3] hover:border-[#DDD5C7]"
              } ${isResolved ? "opacity-60 cursor-default" : ""}`}
            >
              <div className="flex items-center justify-between font-semibold text-[#1C1917] mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.deviceName}</span>
                </div>
                {isSelected && !isResolved && (
                  <Check className="w-3.5 h-3.5 text-teal-700" />
                )}
                {isResolved && isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                )}
              </div>
              <p className="font-mono text-[11px] text-[#2E2822]">{opt.progress}</p>
              <p className="text-[10px] text-[#78716C]">
                {new Date(opt.timestamp).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleResolve}
        disabled={isResolved || !selectedDeviceId}
        className={`w-full py-2 px-4 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors ${
          isResolved
            ? "bg-emerald-600 cursor-default"
            : "bg-[#18181B] hover:bg-[#27272A]"
        }`}
      >
        {isResolved ? "Progress Synchronized" : "Keep Selected Progress"}
      </button>
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const SyncDeviceCenter: React.FC<SyncDeviceCenterProps> = ({
  devices = [],
  conflict = null,
  loading = false,
  onSyncAll,
  onSyncDevice,
  onManageDevice,
  onWakeDevice,
  onResolveConflict,
  footerText = "• LUMA SCHOLARLY PROFESSIONAL — SYNC ACTIVE",
  footerLinks = [
    { label: "Documentation", href: "#docs" },
    { label: "Privacy Policy", href: "#privacy" },
    { label: "System Status", href: "#status" },
  ],
}) => {
  const handleSyncAll = useCallback(() => {
    onSyncAll?.();
  }, [onSyncAll]);

  const handleSyncDevice = useCallback(
    (id: string) => {
      onSyncDevice?.(id);
    },
    [onSyncDevice]
  );

  const handleManageDevice = useCallback(
    (id: string) => {
      onManageDevice?.(id);
    },
    [onManageDevice]
  );

  const handleWakeDevice = useCallback(
    (id: string) => {
      onWakeDevice?.(id);
    },
    [onWakeDevice]
  );

  const handleResolveConflict = useCallback(
    (conflictId: string, chosenDeviceId: string) => {
      onResolveConflict?.(conflictId, chosenDeviceId);
    },
    [onResolveConflict]
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6 justify-between">
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-12">
        {/* Top Header */}
        <div className="flex items-start justify-between border-b border-[#E5DFD3] pb-6">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
              Device Center
            </h1>
            <p className="text-xs text-[#78716C] leading-relaxed">
              Manage your connected hardware and synchronization status.
            </p>
          </div>

          <button
            onClick={handleSyncAll}
            disabled={loading || devices.length === 0}
            className="py-2 px-3.5 bg-white border border-[#DDD5C7] hover:bg-[#F5EFE6] disabled:opacity-50 text-xs font-semibold text-[#1C1917] rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#78716C]" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-[#78716C]" />
            )}
            <span>Sync All</span>
          </button>
        </div>

        {/* 2‑Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left 2 Cols: Device List */}
          <div className="lg:col-span-2 space-y-4" role="list">
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#78716C] mx-auto" />
                <p className="text-xs text-[#78716C] mt-2">Loading devices…</p>
              </div>
            ) : devices.length === 0 ? (
              <div className="bg-white border border-[#E5DFD3] rounded-2xl p-8 text-center">
                <Smartphone className="w-8 h-8 text-[#A8A29E] mx-auto" />
                <h3 className="font-serif text-base font-bold text-[#1C1917] mt-2">No devices connected</h3>
                <p className="text-xs text-[#78716C]">
                  Connect a device to start syncing your library.
                </p>
              </div>
            ) : (
              devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onSync={handleSyncDevice}
                  onManage={handleManageDevice}
                  onWake={handleWakeDevice}
                />
              ))
            )}
          </div>

          {/* Right Column: Sync Conflict Card */}
          <div className="space-y-3">
            {conflict && !loading && (
              <ConflictCard
                conflict={conflict}
                onResolve={handleResolveConflict}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full pt-4 border-t border-[#E5DFD3] flex items-center justify-between text-[11px] text-[#78716C]">
        <span className="font-mono text-[10px]">{footerText}</span>
        <div className="flex items-center gap-4 text-xs">
          {footerLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-[#1C1917] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
};