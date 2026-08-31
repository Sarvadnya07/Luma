import React, { useState } from "react";
import { Search, AlertTriangle, Sparkles, BookOpen, Layers } from "lucide-react";

export const IntegrationsPluginsView: React.FC = () => {
  const [isReadwiseEnabled, setIsReadwiseEnabled] = useState(true);
  const [isZoteroEnabled, setIsZoteroEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const plugins = [
    {
      id: "lexicon_parser",
      name: "Lexicon Parser",
      version: "v1.2",
      description: "Provides inline Latin and Greek translations on hover in text views.",
      icon: BookOpen,
      installed: true,
    },
    {
      id: "citation_formatter",
      name: "Citation Formatter",
      version: "v2.0",
      description: "Automatically format copied excerpts into APA, MLA, or Chicago styles.",
      icon: Layers,
      installed: true,
    },
    {
      id: "reading_vitals",
      name: "Reading Vitals",
      version: "v0.9",
      description: "Tracks scholarly reading velocity and comprehension metrics.",
      icon: Sparkles,
      installed: false,
    },
  ];

  const filteredPlugins = plugins.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6 justify-between">
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-12">
        {/* Main Heading */}
        <div className="space-y-1 border-b border-[#E5DFD3] pb-6">
          <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
            Integrations & Plugins
          </h1>
          <p className="text-xs text-[#78716C] leading-relaxed max-w-xl">
            Manage external scholarly connections and extend your reading environment with community-developed tools.
          </p>
        </div>

        {/* 2-Column Grid: Active Integrations (Left) vs Plugin Directory (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Active Integrations */}
          <div className="lg:col-span-2 space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
              ACTIVE INTEGRATIONS
            </span>

            {/* Readwise Integration Card */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] flex items-center justify-center font-serif text-base font-bold text-[#1C1917]">
                    R
                  </div>
                  <div>
                    <h3 className="font-serif text-sm font-bold text-[#1C1917]">Readwise</h3>
                    <p className="text-[11px] text-emerald-700 font-medium">Running automatically</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsReadwiseEnabled(!isReadwiseEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    isReadwiseEnabled ? "bg-[#18181B]" : "bg-[#E5DFD3]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      isReadwiseEnabled ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-[#57534E] leading-relaxed">
                Continuously export highlights and annotations to your Readwise account for spaced repetition review.
              </p>

              {/* Permissions */}
              <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-xl p-3 space-y-1.5 text-xs text-[#78716C]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1C1917] block font-mono">
                  PERMISSIONS
                </span>
                <p>• Read access to Highlights (421 Reflections)</p>
                <p>• Read access to Scholarly Notes</p>
              </div>
            </div>

            {/* Zotero Integration Card */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#E5DFD3] flex items-center justify-center font-serif text-base font-bold text-[#1C1917]">
                    Z
                  </div>
                  <div>
                    <h3 className="font-serif text-sm font-bold text-[#1C1917]">Zotero</h3>
                    <p className="text-[11px] text-[#78716C]">Manual sync required</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsZoteroEnabled(!isZoteroEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    isZoteroEnabled ? "bg-[#18181B]" : "bg-[#E5DFD3]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                      isZoteroEnabled ? "right-1" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-[#57534E] leading-relaxed">
                Two-way synchronization of bibliographic metadata, PDFs, and scholarly citations.
              </p>

              {/* Alert Box */}
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>Authentication token expired. Re-connect required.</span>
              </div>
            </div>
          </div>

          {/* Right Column: Plugin Directory */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
              PLUGIN DIRECTORY
            </span>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
              <input
                type="text"
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFFFF] border border-[#DDD5C7] rounded-lg text-xs placeholder:text-[#A8A29E] focus:outline-none focus:border-[#18181B]"
              />
            </div>

            {/* Plugin Cards List */}
            <div className="space-y-2.5">
              {filteredPlugins.map((plugin) => {
                const Icon = plugin.icon;
                return (
                  <div
                    key={plugin.id}
                    className="p-3.5 bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl space-y-1.5 shadow-2xs group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-[#78716C]" />
                        <h4 className="font-serif text-xs font-bold text-[#1C1917] group-hover:text-black">
                          {plugin.name}
                        </h4>
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#78716C] border border-[#E5DFD3]">
                        {plugin.version}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#57534E] leading-relaxed">
                      {plugin.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
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
