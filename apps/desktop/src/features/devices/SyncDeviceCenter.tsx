import React, { useState } from "react";
import {
  Laptop,
  Tablet,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  WifiOff,
  Check,
} from "lucide-react";

export const SyncDeviceCenter: React.FC = () => {
  const [selectedConflictDevice, setSelectedConflictDevice] = useState<"ipad" | "mac">("ipad");
  const [isConflictResolved, setIsConflictResolved] = useState(false);

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

          <button className="py-2 px-3.5 bg-[#FFFFFF] border border-[#DDD5C7] hover:bg-[#F5EFE6] text-xs font-semibold text-[#1C1917] rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-[#78716C]" />
            <span>Sync All</span>
          </button>
        </div>

        {/* 2-Column Grid: Devices List (Left) + Sync Conflict Card (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left 2 Cols: Connected Hardware List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Device 1: MacBook Pro */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] flex items-center justify-center flex-shrink-0">
                  <Laptop className="w-5 h-5 text-[#1C1917]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif text-sm font-bold text-[#1C1917]">MacBook Pro 16"</h4>
                  <p className="text-[11px] text-[#78716C] font-mono">Luma Desktop v1.4.1</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>SYNCED JUST NOW</span>
                  </div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="text-[11px] text-[#78716C] block font-mono">
                  Local Storage: 24 GB / 512 GB
                </span>
                <button className="text-xs text-[#1C1917] hover:underline font-semibold">
                  Manage
                </button>
              </div>
            </div>

            {/* Device 2: iPad Pro */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] flex items-center justify-center flex-shrink-0">
                  <Tablet className="w-5 h-5 text-[#1C1917]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif text-sm font-bold text-[#1C1917]">iPad Pro</h4>
                  <p className="text-[11px] text-[#78716C] font-mono">Luma Mobile v1.4.1</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#78716C] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>SYNCED 12 MIN AGO</span>
                  </div>
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="text-[11px] text-[#78716C] block font-mono">
                  Battery: 82%
                </span>
                <button className="py-1 px-2.5 bg-[#FAF7F2] border border-[#DDD5C7] hover:bg-[#EFEAE1] text-xs font-semibold text-[#1C1917] rounded-lg transition-colors">
                  Sync Now
                </button>
              </div>
            </div>

            {/* Device 3: Luma Reader E-Ink */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs flex items-center justify-between opacity-80">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-5 h-5 text-[#8C8275]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-serif text-sm font-bold text-[#1C1917]">Luma Reader</h4>
                  <p className="text-[11px] text-[#78716C] font-mono">E-Ink Device v1.1</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#78716C] font-bold uppercase tracking-wider">
                    <WifiOff className="w-3 h-3 text-[#A8A29E]" />
                    <span>OFFLINE (LAST SEEN 2 DAYS AGO)</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <button className="text-xs text-[#78716C] hover:text-[#18181B] font-semibold">
                  Wake
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Sync Conflict Resolution Card */}
          <div className="space-y-3">
            <div className="bg-[#FFFFFF] border border-amber-300 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>SYNC CONFLICT</span>
                </div>
                <span className="text-[10px] text-amber-700 font-mono">1 unresolved</span>
              </div>

              <div className="space-y-1">
                <h4 className="font-serif text-sm font-bold text-[#1C1917]">
                  "The Decline and Fall of the Roman Empire"
                </h4>
                <p className="text-xs text-[#78716C]">
                  Reading progress mismatch detected between devices.
                </p>
              </div>

              {/* Conflict Choices */}
              <div className="space-y-2 text-xs">
                {/* Option 1: iPad Pro */}
                <div
                  onClick={() => setSelectedConflictDevice("ipad")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedConflictDevice === "ipad"
                      ? "bg-teal-50/50 border-teal-600 ring-1 ring-teal-600"
                      : "bg-[#FAF7F2] border-[#E5DFD3] hover:border-[#DDD5C7]"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-[#1C1917] mb-1">
                    <div className="flex items-center gap-2">
                      <Tablet className="w-3.5 h-3.5" />
                      <span>iPad Pro</span>
                    </div>
                    {selectedConflictDevice === "ipad" && (
                      <Check className="w-3.5 h-3.5 text-teal-700" />
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-[#2E2822]">Page 442 (Chapter 16)</p>
                  <p className="text-[10px] text-[#78716C]">Today at 10:42 PM</p>
                </div>

                {/* Option 2: MacBook Pro */}
                <div
                  onClick={() => setSelectedConflictDevice("mac")}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedConflictDevice === "mac"
                      ? "bg-teal-50/50 border-teal-600 ring-1 ring-teal-600"
                      : "bg-[#FAF7F2] border-[#E5DFD3] hover:border-[#DDD5C7]"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-[#1C1917] mb-1">
                    <div className="flex items-center gap-2">
                      <Laptop className="w-3.5 h-3.5" />
                      <span>MacBook Pro</span>
                    </div>
                    {selectedConflictDevice === "mac" && (
                      <Check className="w-3.5 h-3.5 text-teal-700" />
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-[#2E2822]">Page 410 (Chapter 15)</p>
                  <p className="text-[10px] text-[#78716C]">Yesterday at 8:15 PM</p>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => setIsConflictResolved(true)}
                className="w-full py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors"
              >
                {isConflictResolved ? "Progress Synchronized" : "Keep Selected Progress"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer bar matching screenshots */}
      <footer className="max-w-5xl mx-auto w-full pt-4 border-t border-[#E5DFD3] flex items-center justify-between text-[11px] text-[#78716C]">
        <span className="font-mono text-[10px]">
          • LUMA SCHOLARLY PROFESSIONAL — SYNC ACTIVE
        </span>
        <div className="flex items-center gap-4 text-xs">
          <a href="#docs" className="hover:text-[#1C1917]">Documentation</a>
          <a href="#privacy" className="hover:text-[#1C1917]">Privacy Policy</a>
          <a href="#status" className="hover:text-[#1C1917]">System Status</a>
        </div>
      </footer>
    </div>
  );
};
