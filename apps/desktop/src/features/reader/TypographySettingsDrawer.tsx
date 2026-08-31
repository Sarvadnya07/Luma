import React from "react";
import { RotateCcw, AlignLeft, AlignJustify, MoveHorizontal } from "lucide-react";
import { useReaderStore } from "../../state/readerState";

export const TypographySettingsDrawer: React.FC = () => {
  const isTypographyOpen = useReaderStore((s) => s.isTypographyOpen);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const settings = useReaderStore((s) => s.settings);
  const updateSettings = useReaderStore((s) => s.updateSettings);

  if (!isTypographyOpen) return null;

  const themes = [
    { id: "light" as const, label: "Light", bg: "bg-[#FFFFFF]", border: "border-[#DDD5C7]" },
    { id: "sepia" as const, label: "Sepia", bg: "bg-[#F5EFE6]", border: "border-[#D8C7A5]" },
    { id: "paper" as const, label: "Misty", bg: "bg-[#EAEFEF]", border: "border-[#CCD6D6]" },
    { id: "eink" as const, label: "E-Ink", bg: "bg-[#FFFFFF]", border: "border-[#000000]" },
    { id: "dark" as const, label: "Dark", bg: "bg-[#18181B]", border: "border-[#27272A]" },
  ];

  const handleResetDefaults = () => {
    updateSettings({
      fontSize: 18,
      fontFamily: "serif",
      lineHeight: 1.5,
      theme: "light",
      layoutMode: "paginated",
    });
  };

  return (
    <div className="fixed right-6 top-14 z-50 w-72 bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl shadow-2xl p-5 space-y-4 animate-in slide-in-from-right duration-150 text-[#1C1917]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-2.5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">APPEARANCE</h3>
        <button
          onClick={toggleTypography}
          className="text-xs text-[#78716C] hover:text-[#18181B] font-medium"
        >
          close
        </button>
      </div>

      {/* TYPEFACE */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
          TYPEFACE
        </span>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Literata (Serif) */}
          <button
            onClick={() => updateSettings({ fontFamily: "serif" })}
            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
              settings.fontFamily === "serif"
                ? "bg-[#FFFFFF] border-teal-600 ring-1 ring-teal-600 shadow-xs"
                : "bg-[#FFFFFF] border-[#E5DFD3] hover:border-[#DDD5C7]"
            }`}
          >
            <span className="font-serif text-xl font-bold text-[#1C1917]">Ag</span>
            <span className={`text-[11px] ${settings.fontFamily === "serif" ? "font-bold text-teal-800" : "text-[#78716C]"}`}>
              Literata
            </span>
          </button>

          {/* Inter (Sans) */}
          <button
            onClick={() => updateSettings({ fontFamily: "sans" })}
            className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
              settings.fontFamily === "sans"
                ? "bg-[#FFFFFF] border-teal-600 ring-1 ring-teal-600 shadow-xs"
                : "bg-[#FFFFFF] border-[#E5DFD3] hover:border-[#DDD5C7]"
            }`}
          >
            <span className="font-sans text-xl font-bold text-[#1C1917]">Ag</span>
            <span className={`text-[11px] ${settings.fontFamily === "sans" ? "font-bold text-teal-800" : "text-[#78716C]"}`}>
              Inter
            </span>
          </button>
        </div>
      </div>

      {/* SIZE Slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C]">SIZE</span>
          <span className="font-mono text-[11px] text-[#78716C]">{settings.fontSize}px</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-serif text-[#78716C]">A</span>
          <input
            type="range"
            min={13}
            max={28}
            step={1}
            value={settings.fontSize}
            onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value, 10) })}
            className="w-full h-1 bg-[#E5DFD3] rounded-lg appearance-none cursor-pointer accent-[#18181B]"
          />
          <span className="text-base font-serif font-bold text-[#1C1917]">A</span>
        </div>
      </div>

      {/* SPACING */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
          SPACING
        </span>
        <div className="grid grid-cols-3 gap-1.5 bg-[#EFEAE1] p-1 rounded-xl">
          {[
            { val: 1.3, label: "Tight", icon: AlignLeft },
            { val: 1.5, label: "Normal", icon: AlignJustify },
            { val: 1.8, label: "Relaxed", icon: MoveHorizontal },
          ].map((sp) => (
            <button
              key={sp.val}
              onClick={() => updateSettings({ lineHeight: sp.val })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                settings.lineHeight === sp.val
                  ? "bg-[#FFFFFF] text-[#1C1917] shadow-2xs font-semibold"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <sp.icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
      </div>

      {/* WIDTH */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
          WIDTH
        </span>
        <div className="grid grid-cols-3 gap-1.5 bg-[#EFEAE1] p-1 rounded-xl text-xs">
          {[
            { id: "narrow", label: "Narrow" },
            { id: "normal", label: "Normal" },
            { id: "wide", label: "Wide" },
          ].map((w) => (
            <button
              key={w.id}
              onClick={() => {}}
              className={`py-1.5 rounded-lg font-medium transition-all ${
                w.id === "normal"
                  ? "bg-[#FFFFFF] text-[#1C1917] shadow-2xs font-semibold"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* THEME Swatches */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
          THEME
        </span>
        <div className="grid grid-cols-4 gap-2">
          {themes.map((t) => {
            const isSelected = settings.theme === t.id;

            return (
              <button
                key={t.id}
                onClick={() => updateSettings({ theme: t.id })}
                className="flex flex-col items-center gap-1 group"
              >
                <div
                  className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${t.bg} ${t.border} ${
                    isSelected ? "ring-2 ring-[#18181B] ring-offset-2 scale-105" : "hover:scale-105"
                  }`}
                />
                <span className={`text-[10px] ${isSelected ? "font-bold text-[#1C1917]" : "text-[#78716C]"}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset to Defaults */}
      <div className="pt-2 border-t border-[#E5DFD3]">
        <button
          onClick={handleResetDefaults}
          className="w-full py-2 px-3 bg-[#FFFFFF] border border-[#DDD5C7] hover:bg-[#F5EFE6] text-xs font-semibold text-[#57534E] hover:text-[#1C1917] rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};
