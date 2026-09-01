import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Book } from "@luma/shared-types";
import { BookOpen } from "lucide-react";
import { LumaApi } from "../../lib/tauri";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface BookCoverThumbnailProps {
  book: Book;
  author?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Custom fallback text for the author line on stylized cover */
  fallbackAuthorText?: string;
  /** Custom fallback text for the "edition" line on stylized cover (bottom left) */
  fallbackEditionText?: string;
  /** Custom fallback text for the "format" line on stylized cover (bottom right) */
  fallbackFormatText?: string;
  /** Custom palette definitions (array of objects) to override the default palettes */
  customPalettes?: CoverPalette[];
  /** Optional custom title cleaning function (receives raw title, returns cleaned title) */
  cleanTitleFn?: (raw: string) => string;
  /** Optional loading placeholder element while cover is loading */
  loadingPlaceholder?: React.ReactNode;
}

export interface CoverPalette {
  bg: string; // tailwind bg gradient classes: "from-X to-Y"
  border: string; // tailwind border color class
  text: string; // tailwind text color class
  sub: string; // tailwind text color class for subtext
  accent: string; // hex color for accent elements (icon, line)
}

// ------------------------------------------------------------------
// Internal Constants
// ------------------------------------------------------------------

const DEFAULT_PALETTES: CoverPalette[] = [
  { bg: "from-[#2C1810] to-[#1A0F0A]", border: "border-[#4A2E20]", text: "text-[#E6C280]", sub: "text-[#A88B58]", accent: "#C9A84C" },
  { bg: "from-[#0F2027] to-[#203A43]", border: "border-[#2C5364]", text: "text-[#E0EAFC]", sub: "text-[#8BA4B8]", accent: "#6DD5ED" },
  { bg: "from-[#134E5E] to-[#2B580C]", border: "border-[#3B6E1E]", text: "text-[#E2F0D9]", sub: "text-[#9EBF88]", accent: "#71B280" },
  { bg: "from-[#3D0C11] to-[#631922]", border: "border-[#8A2938]", text: "text-[#FCE4E6]", sub: "text-[#D48995]", accent: "#E05A6D" },
  { bg: "from-[#232526] to-[#414345]", border: "border-[#55585C]", text: "text-[#F5F5F5]", sub: "text-[#9E9E9E]", accent: "#E0E0E0" },
  { bg: "from-[#4A2810] to-[#6E3B18]", border: "border-[#8F4E22]", text: "text-[#FDEBD0]", sub: "text-[#D29F68]", accent: "#F39C12" },
];

// Cache for cover data URLs
const coverCache = new Map<string, string>();

// ------------------------------------------------------------------
// Utility Functions (exported for reuse)
// ------------------------------------------------------------------

/**
 * Default title cleaning function.
 * Strips hash prefixes, common download site tags, and normalizes capitalization.
 */
export function cleanDisplayTitle(raw: string): string {
  if (!raw) return "Untitled Document";
  let t = raw.trim();
  t = t.replace(/^[0-9a-fA-F]{24,64}[\s_-]+/, "");
  t = t.replace(/\s*(\(\s*(?:pdfdrive|z-lib\.org|oceanofpdf|libgen|retail|original)\s*\)|retailnbsped|nbsped)\s*/gi, " ");
  t = t.replace(/[_-]/g, " ").trim();

  if (t === t.toLowerCase() || t === t.toUpperCase()) {
    t = t
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return t || "Untitled Document";
}

/**
 * Deterministically picks a palette based on a string (book id + title).
 */
function getDeterministicPalette(
  str: string,
  palettes: CoverPalette[] = DEFAULT_PALETTES
): CoverPalette {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % palettes.length;
  return palettes[idx]!;
}

// ------------------------------------------------------------------
// Sub-component: FallbackCover
// ------------------------------------------------------------------

interface FallbackCoverProps {
  title: string;
  author: string;
  editionText: string;
  formatText: string;
  palette: CoverPalette;
  size: "sm" | "md" | "lg";
}

const FallbackCover: React.FC<FallbackCoverProps> = ({
  title,
  author,
  editionText,
  formatText,
  palette,
  size,
}) => {
  const textSize =
    size === "sm"
      ? "text-[9px]"
      : size === "lg"
      ? "text-sm font-bold"
      : "text-[11px] font-semibold";

  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${palette.bg} ${palette.border} border p-3 flex flex-col justify-between text-center relative overflow-hidden shadow-inner`}
    >
      {/* Spine crease & highlights */}
      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 via-white/10 to-transparent pointer-events-none" />
      <div className="absolute inset-x-2 top-2 bottom-2 border border-white/10 rounded-xs pointer-events-none" />

      {/* Top Stamp / Format */}
      <div className="relative z-10 pt-1">
        <span className={`text-[8px] uppercase tracking-widest ${palette.sub} font-mono block truncate`}>
          {author || "Luma Classic Edition"}
        </span>
      </div>

      {/* Center Title */}
      <div className="relative z-10 my-auto px-1">
        <BookOpen
          className="w-4 h-4 mx-auto mb-1.5 opacity-60"
          style={{ color: palette.accent }}
        />
        <h4 className={`font-serif leading-snug ${palette.text} ${textSize} line-clamp-3`}>
          {title}
        </h4>
        <div
          className="w-6 h-[1px] mx-auto mt-2 opacity-50"
          style={{ backgroundColor: palette.accent }}
        />
      </div>

      {/* Bottom Stamp */}
      <div className="relative z-10 pb-0.5 flex justify-between items-center">
        <span className="text-[7px] text-white/40 tracking-wider uppercase font-mono">
          {editionText}
        </span>
        <span className="text-[7px] text-white/40 tracking-wider uppercase font-mono">
          {formatText}
        </span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const BookCoverThumbnail: React.FC<BookCoverThumbnailProps> = ({
  book,
  author,
  className = "",
  size = "md",
  fallbackAuthorText = "Luma Classic Edition",
  fallbackEditionText = "Digital Edition",
  fallbackFormatText = "Luma",
  customPalettes,
  cleanTitleFn,
  loadingPlaceholder,
}) => {
  const palettes = customPalettes ?? DEFAULT_PALETTES;

  const [coverUrl, setCoverUrl] = useState<string | null>(() => {
    if (book.cover_image_path?.startsWith("data:") || book.cover_image_path?.startsWith("http")) {
      return book.cover_image_path;
    }
    return coverCache.get(book.id) || null;
  });

  const [loading, setLoading] = useState<boolean>(!coverUrl);
  const [hasError, setHasError] = useState<boolean>(false);

  // Compute cleaned title and author
  const displayTitle = useMemo(() => {
    if (cleanTitleFn) {
      return cleanTitleFn(book.title) || "Untitled Document";
    }
    return cleanDisplayTitle(book.title);
  }, [book.title, cleanTitleFn]);

  const displayAuthor = useMemo(() => {
    if (author && author !== "Unknown Author") return author;
    return "";
  }, [author]);

  // Deterministic palette based on book id + title
  const palette = useMemo(() => {
    return getDeterministicPalette(book.id + book.title, palettes);
  }, [book.id, book.title, palettes]);

  // Load cover from API if not already cached or provided inline
  useEffect(() => {
    let isCancelled = false;

    // If cover is already a data URL or http URL, use it directly
    if (book.cover_image_path?.startsWith("data:") || book.cover_image_path?.startsWith("http")) {
      setCoverUrl(book.cover_image_path);
      setLoading(false);
      return;
    }

    // If cached, use it
    if (coverCache.has(book.id)) {
      setCoverUrl(coverCache.get(book.id)!);
      setLoading(false);
      return;
    }

    // Reset states
    setCoverUrl(null);
    setLoading(true);
    setHasError(false);

    async function loadCover() {
      try {
        const dataUrl = await LumaApi.getBookCoverDataUrl(book.id);
        if (!isCancelled && dataUrl) {
          coverCache.set(book.id, dataUrl);
          setCoverUrl(dataUrl);
          setLoading(false);
        } else {
          // No data URL, but we keep loading false to show fallback
          setLoading(false);
        }
      } catch {
        if (!isCancelled) {
          setHasError(true);
          setLoading(false);
        }
      }
    }

    loadCover();

    return () => {
      isCancelled = true;
    };
  }, [book.id, book.cover_image_path]);

  // Handle image load error: fallback to stylized cover
  const handleImageError = useCallback(() => {
    setHasError(true);
    setCoverUrl(null);
    setLoading(false);
  }, []);

  // If still loading and placeholder provided, show it
  if (loading && loadingPlaceholder) {
    return <div className={`relative w-full h-full ${className}`}>{loadingPlaceholder}</div>;
  }

  const shouldShowFallback = !coverUrl || hasError;

  return (
    <div
      className={`relative w-full h-full rounded-md overflow-hidden shadow-sm flex items-center justify-center select-none ${className}`}
      role="img"
      aria-label={`Cover of ${displayTitle}`}
    >
      {shouldShowFallback ? (
        <FallbackCover
          title={displayTitle}
          author={displayAuthor || fallbackAuthorText}
          editionText={fallbackEditionText}
          formatText={fallbackFormatText}
          palette={palette}
          size={size}
        />
      ) : (
        <div className="relative w-full h-full">
          <img
            src={coverUrl}
            alt={displayTitle}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
          {/* Subtle Spine Depth Shadow */}
          <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/30 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-l from-black/15 to-transparent pointer-events-none" />
        </div>
      )}
    </div>
  );
};