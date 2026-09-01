import React, { useEffect, useState } from "react";
import { Book } from "@luma/shared-types";
import { BookOpen } from "lucide-react";
import { LumaApi } from "../../lib/tauri";

export interface BookCoverThumbnailProps {
  book: Book;
  author?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const coverCache = new Map<string, string>();

const COVER_PALETTES = [
  { bg: "from-[#2C1810] to-[#1A0F0A]", border: "border-[#4A2E20]", text: "text-[#E6C280]", sub: "text-[#A88B58]", accent: "#C9A84C" }, // Classic Leather / Gold
  { bg: "from-[#0F2027] to-[#203A43]", border: "border-[#2C5364]", text: "text-[#E0EAFC]", sub: "text-[#8BA4B8]", accent: "#6DD5ED" }, // Oxford Midnight
  { bg: "from-[#134E5E] to-[#2B580C]", border: "border-[#3B6E1E]", text: "text-[#E2F0D9]", sub: "text-[#9EBF88]", accent: "#71B280" }, // Forest Botanical
  { bg: "from-[#3D0C11] to-[#631922]", border: "border-[#8A2938]", text: "text-[#FCE4E6]", sub: "text-[#D48995]", accent: "#E05A6D" }, // Crimson Burgundy
  { bg: "from-[#232526] to-[#414345]", border: "border-[#55585C]", text: "text-[#F5F5F5]", sub: "text-[#9E9E9E]", accent: "#E0E0E0" }, // Charcoal Minimal
  { bg: "from-[#4A2810] to-[#6E3B18]", border: "border-[#8F4E22]", text: "text-[#FDEBD0]", sub: "text-[#D29F68]", accent: "#F39C12" }, // Warm Terracotta
];

export function cleanDisplayTitle(raw: string): string {
  if (!raw) return "Untitled Document";
  let t = raw.trim();
  // Strip 24-64 character hex hash prefixes
  t = t.replace(/^[0-9a-fA-F]{24,64}[\s_-]+/, "");
  // Strip common download tags
  t = t.replace(/\s*(\(\s*(?:pdfdrive|z-lib\.org|oceanofpdf|libgen|retail|original)\s*\)|retailnbsped|nbsped)\s*/gi, " ");
  t = t.replace(/[_-]/g, " ").trim();

  // Capitalize words
  if (t === t.toLowerCase() || t === t.toUpperCase()) {
    t = t
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return t || "Untitled Document";
}

function getDeterministicPalette(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[idx]!;
}

export const BookCoverThumbnail: React.FC<BookCoverThumbnailProps> = ({
  book,
  author,
  className = "",
  size = "md",
}) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(() => {
    if (book.cover_image_path?.startsWith("data:") || book.cover_image_path?.startsWith("http")) {
      return book.cover_image_path;
    }
    return coverCache.get(book.id) || null;
  });

  useEffect(() => {
    let isCancelled = false;

    if (coverUrl && (coverUrl.startsWith("data:") || coverUrl.startsWith("http"))) {
      return;
    }

    if (coverCache.has(book.id)) {
      setCoverUrl(coverCache.get(book.id)!);
      return;
    }

    async function loadCover() {
      try {
        const dataUrl = await LumaApi.getBookCoverDataUrl(book.id);
        if (!isCancelled && dataUrl) {
          coverCache.set(book.id, dataUrl);
          setCoverUrl(dataUrl);
        }
      } catch (err) {
        // Fallback to stylized cover
      }
    }

    loadCover();

    return () => {
      isCancelled = true;
    };
  }, [book.id, book.cover_image_path]);

  const displayTitle = cleanDisplayTitle(book.title);
  const displayAuthor = author && author !== "Unknown Author" ? author : "";
  const palette = getDeterministicPalette(book.id + book.title);

  const textSize =
    size === "sm"
      ? "text-[9px]"
      : size === "lg"
      ? "text-sm font-bold"
      : "text-[11px] font-semibold";

  return (
    <div
      className={`relative w-full h-full rounded-md overflow-hidden shadow-sm flex items-center justify-center select-none ${className}`}
    >
      {coverUrl ? (
        <div className="relative w-full h-full">
          <img
            src={coverUrl}
            alt={displayTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Subtle Spine Depth Shadow */}
          <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-black/15 to-transparent pointer-events-none" />
        </div>
      ) : (
        /* Stylized Editorial Book Cover */
        <div
          className={`w-full h-full bg-gradient-to-br ${palette.bg} ${palette.border} border p-3 flex flex-col justify-between text-center relative overflow-hidden shadow-inner`}
        >
          {/* Spine crease & highlights */}
          <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
          <div className="absolute inset-x-2 top-2 bottom-2 border border-white/10 rounded-xs pointer-events-none" />

          {/* Top Stamp / Format */}
          <div className="relative z-10 pt-1">
            <span
              className={`text-[8px] uppercase tracking-widest ${palette.sub} font-mono block truncate`}
            >
              {displayAuthor || "Luma Classic Edition"}
            </span>
          </div>

          {/* Center Title */}
          <div className="relative z-10 my-auto px-1">
            <BookOpen
              className="w-4 h-4 mx-auto mb-1.5 opacity-60"
              style={{ color: palette.accent }}
            />
            <h4
              className={`font-serif leading-snug ${palette.text} ${textSize} line-clamp-3`}
            >
              {displayTitle}
            </h4>
            <div
              className="w-6 h-[1px] mx-auto mt-2 opacity-50"
              style={{ backgroundColor: palette.accent }}
            />
          </div>

          {/* Bottom Stamp */}
          <div className="relative z-10 pb-0.5">
            <span className="text-[7px] text-white/40 tracking-wider uppercase font-mono">
              {book.primary_file_id ? "Digital Edition" : "Luma"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
