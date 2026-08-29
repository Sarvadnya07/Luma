import React from "react";
import { X, Type, Columns, AlignJustify, Sun, Moon, Coffee, Monitor } from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { ReaderTheme, ReaderLayoutMode } from "@luma/shared-types";

export const TypographySettingsDrawer: React.FC = () => {
  const isTypographyOpen = useReaderStore((s) => s.isTypographyOpen);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const settings = useReaderStore((s) => s.settings);
  const updateSettings = useReaderStore((s) => s.updateSettings);

  if (!isTypographyOpen) return null;

  const themes: { id: ReaderTheme; label: string; icon: any; bg: string; text: string }[] = [
    { id: "dark", label: "Dark", icon: Moon, bg: "bg-slate-950", text: "text-slate-200" },
    { id: "light", label: "Light", icon: Sun, bg: "bg-white", text: "text-slate-900" },
    { id: "sepia", label: "Sepia", icon: Coffee, bg: "bg-[#fbf0d9]", text: "text-[#5f4b32]" },
    { id: "eink", label: "E-Ink", icon: Monitor, bg: "bg-[#f4f4f4]", text: "text-black" },
  ];

  return (
    <div className="fixed right-6 top-16 z-40 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-5 space-y-5 animate-in slide-in-from-top-2 duration-150 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">Reading Settings</h3>
        </div>
        <button
          onClick={toggleTypography}
          className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Theme Selector */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 block">Theme</span>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => updateSettings({ theme: t.id })}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  isSelected ? "border-sky-500 ring-2 ring-sky-500/20" : "border-slate-800 hover:border-slate-700"
                } ${t.bg} ${t.text}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 block">Font Family</span>
        <div className="grid grid-cols-3 gap-2">
          {(["serif", "sans", "mono"] as const).map((font) => (
            <button
              key={font}
              onClick={() => updateSettings({ fontFamily: font })}
              className={`py-2 px-3 rounded-lg border text-xs capitalize transition-all ${
                settings.fontFamily === font
                  ? "bg-sky-500/10 border-sky-500 text-sky-400 font-semibold"
                  : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
              style={{
                fontFamily: font === "serif" ? "Georgia, serif" : font === "sans" ? "Inter, sans-serif" : "monospace",
              }}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Font Size</span>
          <span className="font-mono text-slate-200">{settings.fontSize}px</span>
        </div>
        <input
          type="range"
          min={12}
          max={32}
          step={1}
          value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
      </div>

      {/* Line Height Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Line Spacing</span>
          <span className="font-mono text-slate-200">{settings.lineHeight}x</span>
        </div>
        <input
          type="range"
          min={1.2}
          max={2.4}
          step={0.1}
          value={settings.lineHeight}
          onChange={(e) => updateSettings({ lineHeight: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />
      </div>

      {/* Layout Mode */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <span className="text-[11px] font-semibold text-slate-400 block">Layout Mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateSettings({ layoutMode: "paginated" })}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-colors ${
              settings.layoutMode === "paginated"
                ? "bg-sky-500/10 border-sky-500 text-sky-400 font-semibold"
                : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Paginated
          </button>
          <button
            onClick={() => updateSettings({ layoutMode: "scroll" })}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-colors ${
              settings.layoutMode === "scroll"
                ? "bg-sky-500/10 border-sky-500 text-sky-400 font-semibold"
                : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
            }`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            Scrolling
          </button>
        </div>
      </div>
    </div>
  );
};
