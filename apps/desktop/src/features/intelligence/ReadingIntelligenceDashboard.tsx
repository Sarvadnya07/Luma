import React, { useCallback } from "react";
import {
  BookOpen,
  User,
  Settings,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface HeatmapData {
  weeks: number[][]; // 2D array: weeks x days (0-4)
  daysLabels?: string[]; // defaults to ["M", "Tu", "W", "Th", "F", "Sa", "Su"]
}

export interface CompletedBook {
  id: string;
  title: string;
  author: string;
  // optional: completion date, etc.
}

export interface RecentSession {
  id: string; // book id
  title: string;
  author: string;
  focusTime: string; // e.g., "1h 30m"
  progressPercent: number; // 0-100
}

export interface WeeklyFocus {
  hours: number; // total hours this week
  change?: string; // e.g., "+2.5 Hours" (positive/negative)
  message?: string; // e.g., "Sustained engagement pacing well."
}

export interface QueueItem {
  id: string;
  title: string;
  author: string;
}

export interface DashboardData {
  heatmap: HeatmapData;
  completedBooks: CompletedBook[];
  recentSessions: RecentSession[];
  weeklyFocus: WeeklyFocus;
  queue: QueueItem[];
  timeFocusData?: number[]; // array of values 0-100 for each bar, default length 6
}

export interface ReadingIntelligenceDashboardProps {
  data: DashboardData;
  loading?: boolean;
  error?: string | null;
  tabs?: { id: string; label: string; active?: boolean }[];
  onOpenBook?: (bookId: string) => void;
  onNavigateTab?: (tabId: string) => void;
}

// ------------------------------------------------------------------
// Sub‑components
// ------------------------------------------------------------------

const HeatmapGrid: React.FC<{ data: HeatmapData }> = ({ data }) => {
  const { weeks, daysLabels = ["M", "Tu", "W", "Th", "F", "Sa", "Su"] } = data;

  const getHeatmapColor = (level: number) => {
    switch (level) {
      case 4: return "bg-[#3D5A53]";
      case 3: return "bg-[#5E8379]";
      case 2: return "bg-[#8DA8A0]";
      case 1: return "bg-[#C4D5D0]";
      default: return "bg-[#EAE4DA]";
    }
  };

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block font-mono">
        READING CONSISTENCY
      </span>
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1 text-[9px] font-mono text-[#78716C] text-center pb-1">
          {daysLabels.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="space-y-1">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="grid grid-cols-7 gap-1">
              {week.map((level, dIdx) => (
                <div
                  key={dIdx}
                  className={`aspect-square rounded-xs ${getHeatmapColor(level)} transition-colors`}
                  title={`Activity level: ${level}`}
                  role="img"
                  aria-label={`Day ${dIdx + 1} of week ${wIdx + 1}, activity level ${level}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BooksCompletedList: React.FC<{ books: CompletedBook[] }> = ({ books }) => {
  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block font-mono">
        BOOKS COMPLETED
      </span>
      <div className="space-y-3 font-serif">
        {books.length === 0 ? (
          <p className="text-xs text-[#78716C]">No books completed yet.</p>
        ) : (
          books.slice(0, 3).map((book, idx) => (
            <div key={book.id} className="flex items-baseline gap-3 border-b border-[#EFEAE1] pb-2 last:border-0 last:pb-0">
              <span className="text-3xl font-bold text-[#1C1917]">{idx + 1}</span>
              <div>
                <h4 className="text-xs font-bold text-[#1C1917]">{book.title}</h4>
                <p className="text-[10px] text-[#78716C]">{book.author}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const RecentSessionsList: React.FC<{
  sessions: RecentSession[];
  onOpenBook?: (id: string) => void;
}> = ({ sessions, onOpenBook }) => {
  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
        RECENT SESSIONS
      </span>
      <div className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-xs text-[#78716C]">No recent sessions.</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onOpenBook?.(session.id)}
              className="p-4 bg-white border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
            >
              <div className="space-y-0.5">
                <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black">
                  {session.title}
                </h4>
                <p className="text-xs text-[#78716C]">{session.author}</p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-[#1C1917] block">
                    {session.focusTime}
                  </span>
                  <span className="text-[10px] text-[#78716C]">Focus Time</span>
                </div>

                <div className="w-24 space-y-1">
                  <div className="flex justify-between text-[10px] text-[#78716C] font-mono">
                    <span>{session.progressPercent}% Complete</span>
                  </div>
                  <div className="w-full h-1 bg-[#E5DFD3] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#18181B]"
                      style={{ width: `${session.progressPercent}%` }}
                      role="progressbar"
                      aria-valuenow={session.progressPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const QueueList: React.FC<{
  items: QueueItem[];
  onOpenBook?: (id: string) => void;
}> = ({ items, onOpenBook }) => {
  return (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
        QUEUE
      </span>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-[#78716C]">Your queue is empty.</p>
        ) : (
          items.slice(0, 3).map((item) => (
            <div
              key={item.id}
              onClick={() => onOpenBook?.(item.id)}
              className="p-3 bg-white border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl flex items-center gap-3 cursor-pointer shadow-2xs group"
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
          ))
        )}
      </div>
    </div>
  );
};

const BarChart: React.FC<{ data: number[] }> = ({ data }) => {
  // data: array of values 0-100 representing bar heights
  const bars = data.length >= 6 ? data : [65, 45, 85, 35, 75, 40];
  const maxVal = Math.max(...bars, 1);

  return (
    <div className="space-y-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block font-mono">
        TIME FOCUS
      </span>
      <div className="flex items-end gap-3 h-40 pt-4 border-l border-b border-[#D6CEC2] px-2">
        {bars.map((val, idx) => {
          const height = Math.max((val / maxVal) * 100, 5);
          const color = idx % 2 === 0 ? "#526B64" : "#344440";
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
            >
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${height}%`,
                  backgroundColor: color,
                }}
                role="img"
                aria-label={`Bar ${idx + 1}: ${val}%`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const ReadingIntelligenceDashboard: React.FC<ReadingIntelligenceDashboardProps> = ({
  data,
  loading = false,
  error = null,
  tabs = [
    { id: "library", label: "LIBRARY" },
    { id: "collections", label: "COLLECTIONS" },
    { id: "history", label: "HISTORY", active: true },
  ],
  onOpenBook,
  onNavigateTab,
}) => {
  const {
    heatmap,
    completedBooks,
    recentSessions,
    weeklyFocus,
    queue,
    timeFocusData,
  } = data;

  const handleTabClick = useCallback((tabId: string) => {
    onNavigateTab?.(tabId);
  }, [onNavigateTab]);

  const handleOpenBook = useCallback((bookId: string) => {
    onOpenBook?.(bookId);
  }, [onOpenBook]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#78716C]" />
        <p className="text-xs text-[#78716C] mt-2">Loading dashboard data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6 items-center justify-center">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-xs text-rose-700 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-[#78716C]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`hover:text-[#18181B] transition-colors ${
                  tab.active ? "text-[#18181B] border-b-2 border-[#18181B] pb-1 font-bold" : ""
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#78716C]">
          <button className="p-1.5 hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]" aria-label="User profile">
            <User className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]" aria-label="Settings">
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

        {/* Wood‑Framed "Reading Statistics" Canvas */}
        <div className="p-4 bg-[#D9C4A6] rounded-2xl shadow-xl border-4 border-[#BAA07E]">
          <div className="bg-[#FAF6EE] rounded-xl p-8 border border-[#DDD0BC] shadow-inner space-y-8">
            <h2 className="font-serif text-2xl font-bold text-center tracking-[0.2em] text-[#2E2822] uppercase border-b border-[#E5DFD3] pb-4">
              READING STATISTICS
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              {/* Column 1: Time Focus Bar Chart */}
              <BarChart data={timeFocusData || []} />

              {/* Column 2: Reading Consistency Heatmap */}
              <HeatmapGrid data={heatmap} />

              {/* Column 3: Books Completed */}
              <BooksCompletedList books={completedBooks} />
            </div>
          </div>
        </div>

        {/* Lower Grid: Recent Sessions & Weekly Focus / Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Recent Sessions (2 cols) */}
          <div className="lg:col-span-2">
            <RecentSessionsList sessions={recentSessions} onOpenBook={handleOpenBook} />
          </div>

          {/* Right: Weekly Focus & Queue (1 col) */}
          <div className="space-y-6">
            {/* Weekly Focus */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                WEEKLY FOCUS
              </span>
              <div className="p-5 bg-white border border-[#E5DFD3] rounded-xl shadow-2xs space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-bold font-mono text-[#1C1917]">
                    {weeklyFocus.hours}
                  </span>
                  {weeklyFocus.change && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {weeklyFocus.change}
                    </span>
                  )}
                </div>
                {weeklyFocus.message && (
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    {weeklyFocus.message}
                  </p>
                )}
              </div>
            </div>

            {/* Queue */}
            <QueueList items={queue} onOpenBook={handleOpenBook} />
          </div>
        </div>
      </div>
    </div>
  );
};