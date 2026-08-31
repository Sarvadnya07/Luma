import React from "react";
import { BookOpen } from "lucide-react";
import { useReaderStore } from "../../state/readerState";

export const EInkReaderView: React.FC = () => {
  const closeReader = useReaderStore((s) => s.closeReader);
  const toggleTypography = useReaderStore((s) => s.toggleTypography);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);
  const setSidebarTab = useReaderStore((s) => s.setSidebarTab);
  const sidebarTab = useReaderStore((s) => s.sidebarTab);

  return (
    <div className="w-full h-full bg-[#FFFFFF] text-[#000000] flex flex-col justify-between p-6 select-none font-serif">
      {/* Top Header Bar */}
      <header className="border-b-2 border-black pb-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={closeReader}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            ← Back
          </button>
          <span className="font-serif text-base font-black tracking-widest uppercase">
            LUMA
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarTab(sidebarTab === "toc" ? null : "toc")}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            TOC
          </button>
          <button
            onClick={toggleTypography}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            Tune
          </button>
          <button
            onClick={toggleBookmark}
            className="border-2 border-black px-2.5 py-1 text-xs font-bold font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors"
          >
            Bookmark
          </button>
        </div>
      </header>

      {/* Main E-Ink Reading Canvas */}
      <div className="flex-1 overflow-y-auto max-w-xl mx-auto w-full py-8 space-y-6">
        {/* Title Block */}
        <div className="text-center space-y-2 pb-4">
          <h1 className="text-3xl font-black tracking-widest uppercase text-black font-serif">
            MEDITATIONS
          </h1>
          <p className="text-sm italic text-black">Marcus Aurelius</p>
          <div className="inline-block bg-black text-white px-3 py-1 text-[11px] font-bold font-mono uppercase tracking-widest mt-2">
            BOOK TWO
          </div>
        </div>

        <div className="border-b-2 border-black w-full" />

        {/* High-Contrast Body */}
        <div className="space-y-6 text-sm leading-relaxed text-black">
          <p className="flex items-start gap-2">
            <span className="text-2xl font-black leading-none font-serif">1</span>
            <span>
              Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil.
            </span>
          </p>

          <p>
            But I who have seen the nature of the good that it is beautiful, and of the bad that it is ugly, and the nature of him who does wrong, that it is akin to me, not only of the same blood or seed, but that it participates in the same intelligence and the same portion of the divinity, I can neither be injured by any of them, for no one can fix on me what is ugly, nor can I be angry with my kinsman, nor hate him.
          </p>

          {/* Centered Monochromatic Divider */}
          <div className="py-4 flex flex-col items-center gap-2">
            <div className="w-full border-b border-dashed border-black" />
            <BookOpen className="w-5 h-5 text-black" />
            <div className="w-full border-b border-dashed border-black" />
          </div>

          <p>
            For we are made for co-operation, like feet, like hands, like eyelids, like the rows of the upper and lower teeth. To act against one another then is contrary to nature; and it is acting against one another to be vexed and to turn away.
          </p>
        </div>
      </div>

      {/* Bottom E-Ink Status Bar */}
      <footer className="border-t-2 border-black pt-3 flex items-center justify-between font-mono text-xs font-bold text-black flex-shrink-0">
        <span>PAGE 12 OF 148</span>

        {/* Progress Line */}
        <div className="w-48 h-2.5 border border-black p-0.5">
          <div className="h-full bg-black" style={{ width: "72%" }} />
        </div>

        <span>72% READ</span>
      </footer>
    </div>
  );
};
