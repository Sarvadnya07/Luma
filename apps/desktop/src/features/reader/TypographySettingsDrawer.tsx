import React from "react";
import { X, Type, Columns, AlignJustify, Sun, Moon, Coffee, BookOpen } from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { ReaderTheme } from "@luma/shared-types";

export const TypographySettingsDrawer: React.FC = () => {
  const isTypographyOpen = useReaderStore((s) => s.isTypographyOpen);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const settings = useReaderStore((s) => s.settings);
  const updateSettings = useReaderStore((s) => s.updateSettings);

  if (!isTypographyOpen) return null;

  const themes: { id: ReaderTheme; label: string; icon: any; bg: string; text: string; border: string }[] = [
    { id: "paper" as any, label: "Paper", icon: BookOpen, bg: "bg-[#FAF7F2]", text: "text-[#1C1917]", border: "border-[#D6CEC2]" },
    { id: "sepia", label: "Sepia", icon: Coffee, bg: "bg-[#F4ECD8]", text: "text-[#433422]", border: "border-[#D8C7A5]" },
    { id: "light", label: "Light", icon: Sun, bg: "bg-white", text: "text-slate-900", border: "border-slate-300" },
    { id: "dark", label: "Dark", icon: Moon, bg: "bg-[#18181B]", text: "text-white", border: "border-zinc-700" },
  ];

  return (
    <div className="fixed right-6 top-16 z-40 w-80 bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl shadow-xl p-5 space-y-5 animate-in slide-in-from-top-2 duration-150 text-[#1C1917]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-3">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-[#18181B]" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#1C1917]">Reading Settings</h3>
        </div>
        <button
          onClick={toggleTypography}
          className="p-1 text-[#78716C] hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Theme Selector */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-[#78716C] block">Theme</span>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => updateSettings({ theme: t.id })}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                  isSelected ? "ring-2 ring-[#18181B] font-semibold" : "opacity-80 hover:opacity-100"
                } ${t.bg} ${t.text} ${t.border}`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[10px]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-[#78716C] block">Font Family</span>
        <div className="grid grid-cols-3 gap-2">
          {(["serif", "sans", "mono"] as const).map((font) => (
            <button
              key={font}
              onClick={() => updateSettings({ fontFamily: font })}
              className={`py-2 px-3 rounded-lg border text-xs capitalize transition-all ${
                settings.fontFamily === font
                  ? "bg-[#18181B] text-white border-[#18181B] font-semibold"
                  : "bg-white border-[#E5DFD3] text-[#57534E] hover:border-[#DDD5C7]"
              }`}
              style={{
                fontFamily: font === "serif" ? "Lora, serif" : font === "sans" ? '"Plus Jakarta Sans", sans-serif' : "monospace",
              }}
            >
              {font}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[#78716C]">
          <span>Font Size</span>
          <span className="font-mono text-[#1C1917] font-semibold">{settings.fontSize}px</span>
        </div>
        <input
          type="range"
          min={12}
          max={32}
          step={1}
          value={settings.fontSize}
          onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
          className="w-full h-1.5 bg-[#E5DFD3] rounded-lg appearance-none cursor-pointer accent-[#18181B]"
        />
      </div>

      {/* Line Height Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[#78716C]">
          <span>Line Spacing</span>
          <span className="font-mono text-[#1C1917] font-semibold">{settings.lineHeight}x</span>
        </div>
        <input
          type="range"
          min={1.2}
          max={2.4}
          step={0.1}
          value={settings.lineHeight}
          onChange={(e) => updateSettings({ lineHeight: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-[#E5DFD3] rounded-lg appearance-none cursor-pointer accent-[#18181B]"
        />
      </div>

      {/* Layout Mode */}
      <div className="space-y-2 pt-1 border-t border-[#E5DFD3]">
        <span className="text-[11px] font-semibold text-[#78716C] block">Layout Mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateSettings({ layoutMode: "paginated" })}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-colors ${
              settings.layoutMode === "paginated"
                ? "bg-[#18181B] text-white border-[#18181B] font-semibold"
                : "bg-white border-[#E5DFD3] text-[#57534E] hover:border-[#DDD5C7]"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Paginated
          </button>
          <button
            onClick={() => updateSettings({ layoutMode: "scroll" })}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-colors ${
              settings.layoutMode === "scroll"
                ? "bg-[#18181B] text-white border-[#18181B] font-semibold"
                : "bg-white border-[#E5DFD3] text-[#57534E] hover:border-[#DDD5C7]"
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

