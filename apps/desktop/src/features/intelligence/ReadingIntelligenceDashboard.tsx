import React from "react";
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  User,
  Settings,
  ArrowRight,
} from "lucide-react";
import { Book } from "@luma/shared-types";

export interface ReadingIntelligenceDashboardProps {
  onOpenBook?: (bookId: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const ReadingIntelligenceDashboard: React.FC<ReadingIntelligenceDashboardProps> = ({
  onOpenBook,
  onNavigateTab,
}) => {
  // 5 weeks x 7 days heatmap levels (0 to 4)
  const heatmapData = [
    [1, 2, 0, 3, 2, 4, 3],
    [2, 3, 1, 2, 4, 3, 2],
    [3, 4, 2, 3, 3, 4, 4],
    [2, 1, 3, 4, 2, 3, 1],
    [3, 2, 4, 3, 4, 2, 3],
  ];

  const getHeatmapColor = (lvl: number) => {
    switch (lvl) {
      case 4:
        return "bg-[#3D5A53]"; // deep sage
      case 3:
        return "bg-[#5E8379]";
      case 2:
        return "bg-[#8DA8A0]";
      case 1:
        return "bg-[#C4D5D0]";
      default:
        return "bg-[#EAE4DA]";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-[#78716C]">
            <button
              onClick={() => onNavigateTab?.("library")}
              className="hover:text-[#18181B] transition-colors"
            >
              LIBRARY
            </button>
            <button
              onClick={() => onNavigateTab?.("collections")}
              className="hover:text-[#18181B] transition-colors"
            >
              COLLECTIONS
            </button>
            <button className="text-[#18181B] border-b-2 border-[#18181B] pb-1 font-bold">
              HISTORY
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#78716C]">
          <button className="p-1.5 hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]">
            <User className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto w-full space-y-8 pt-6 pb-16">
        {/* Heading */}
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
            Reading Intelligence
          </h1>
          <p className="text-xs text-[#78716C] max-w-xl leading-relaxed">
            A scholarly overview of your engagement with the library. Metrics reflect sustained focus rather than velocity.
          </p>
        </div>

        {/* Wood-Framed "Reading Statistics" Canvas matching Screenshot 1 */}
        <div className="p-4 bg-[#D9C4A6] rounded-2xl shadow-xl border-4 border-[#BAA07E]">
          <div className="bg-[#FAF6EE] rounded-xl p-8 border border-[#DDD0BC] shadow-inner space-y-8">
            <h2 className="font-serif text-2xl font-bold text-center tracking-[0.2em] text-[#2E2822] uppercase border-b border-[#E5DFD3] pb-4">
              READING STATISTICS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              {/* Column 1: Time Focus Bar Chart */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block font-mono">
                  TIME FOCUS
                </span>
                <div className="flex items-end gap-3 h-40 pt-4 border-l border-b border-[#D6CEC2] px-2">
                  <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full bg-[#526B64] rounded-t-sm" style={{ height: "65%" }} />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full bg-[#344440] rounded-t-sm" style={{ height: "45%" }} />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full bg-[#526B64] rounded-t-sm" style={{ height: "85%" }} />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full bg-[#344440] rounded-t-sm" style={{ height: "35%" }} />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full bg-[#526B64] rounded-t-sm" style={{ height: "75%" }} />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <div className="w-full bg-[#344440] rounded-t-sm" style={{ height: "40%" }} />
                  </div>
                </div>
              </div>

              {/* Column 2: Reading Consistency Heatmap */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block font-mono">
                  READING CONSISTENCY
                </span>
                <div className="space-y-1">
                  <div className="grid grid-cols-7 gap-1 text-[9px] font-mono text-[#78716C] text-center pb-1">
                    <span>M</span>
                    <span>Tu</span>
                    <span>W</span>
                    <span>Th</span>
                    <span>F</span>
                    <span>Sa</span>
                    <span>Su</span>
                  </div>
                  <div className="space-y-1">
                    {heatmapData.map((week, wIdx) => (
                      <div key={wIdx} className="grid grid-cols-7 gap-1">
                        {week.map((level, dIdx) => (
                          <div
                            key={dIdx}
                            className={`aspect-square rounded-xs ${getHeatmapColor(level)} transition-colors`}
                            title={`Activity level: ${level}`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column 3: Books Completed */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block font-mono">
                  BOOKS COMPLETED
                </span>
                <div className="space-y-3 font-serif">
                  <div className="flex items-baseline gap-3 border-b border-[#EFEAE1] pb-2">
                    <span className="text-3xl font-bold text-[#1C1917]">1</span>
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1917]">The Architecture of Silence</h4>
                      <p className="text-[10px] text-[#78716C]">Alain de Botton</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3 border-b border-[#EFEAE1] pb-2">
                    <span className="text-3xl font-bold text-[#1C1917]">2</span>
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1917]">The Overstory</h4>
                      <p className="text-[10px] text-[#78716C]">Richard Powers</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-[#1C1917]">1</span>
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1917]">The Man Who Mistook His Wife</h4>
                      <p className="text-[10px] text-[#78716C]">Oliver Sacks</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Grid: Recent Sessions & Weekly Focus / Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Recent Sessions */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
              RECENT SESSIONS
            </span>

            <div className="space-y-3">
              {[
                {
                  id: "book_decline_fall",
                  title: "The Decline and Fall of the Roman Empire",
                  author: "Edward Gibbon • Vol. 1, Chapter 15",
                  time: "2h 15m",
                  progress: 12,
                },
                {
                  id: "book_meditations",
                  title: "Meditations",
                  author: "Marcus Aurelius • Book V",
                  time: "45m",
                  progress: 54,
                },
                {
                  id: "book_wealth_nations",
                  title: "The Wealth of Nations",
                  author: "Adam Smith • Book 1, Chapter 2",
                  time: "1h 10m",
                  progress: 8,
                },
              ].map((sess) => (
                <div
                  key={sess.id}
                  onClick={() => onOpenBook?.(sess.id)}
                  className="p-4 bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black">
                      {sess.title}
                    </h4>
                    <p className="text-xs text-[#78716C]">{sess.author}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-[#1C1917] block">
                        {sess.time}
                      </span>
                      <span className="text-[10px] text-[#78716C]">Focus Time</span>
                    </div>

                    <div className="w-24 space-y-1">
                      <div className="flex justify-between text-[10px] text-[#78716C] font-mono">
                        <span>{sess.progress}% Complete</span>
                      </div>
                      <div className="w-full h-1 bg-[#E5DFD3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#18181B]"
                          style={{ width: `${sess.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Weekly Focus & Queue */}
          <div className="space-y-6">
            {/* Weekly Focus */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                WEEKLY FOCUS
              </span>
              <div className="p-5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl shadow-2xs space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold font-mono text-[#1C1917]">12</span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    +2.5 Hours
                  </span>
                </div>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  Sustained engagement pacing well. You are on track to meet your scholarly immersion target for the week.
                </p>
              </div>
            </div>

            {/* Queue */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                QUEUE
              </span>
              <div className="space-y-2">
                {[
                  {
                    id: "book_critique_pure_reason",
                    title: "Critique of Pure Reason",
                    author: "Immanuel Kant",
                  },
                  {
                    id: "book_origin_species",
                    title: "On the Origin of Species",
                    author: "Charles Darwin",
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onOpenBook?.(item.id)}
                    className="p-3 bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl flex items-center gap-3 cursor-pointer shadow-2xs group"
                  >
                    <div className="w-7 h-9 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                        {item.title}
                      </h5>
                      <p className="text-[10px] text-[#78716C] truncate">{item.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
