import React from "react";

export interface LumaLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  showWordmark?: boolean;
  className?: string;
  wordmarkColor?: string;
}

export const LumaLogo: React.FC<LumaLogoProps> = ({
  size = 48,
  showWordmark = true,
  className = "",
  wordmarkColor = "#1C1917",
  ...props
}) => {
  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
        {...props}
      >
        <defs>
          {/* Radiant Amber Glow in the book crease */}
          <radialGradient
            id="lumaGlow"
            cx="50%"
            cy="70%"
            r="60%"
            fx="50%"
            fy="75%"
          >
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.85" />
            <stop offset="40%" stopColor="#FCD34D" stopOpacity="0.5" />
            <stop offset="75%" stopColor="#FEF3C7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFFBEB" stopOpacity="0" />
          </radialGradient>

          {/* Warm Page Underlayer Gradient */}
          <linearGradient id="pageGradientLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="60%" stopColor="#FDF4E3" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>

          <linearGradient id="pageGradientRight" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="60%" stopColor="#FDF4E3" />
            <stop offset="100%" stopColor="#FDE68A" />
          </linearGradient>

          {/* Lower Page Underfold Gradient */}
          <linearGradient id="underPageGlow" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* 1. Outer Diamond Frame (Rhombus) */}
        <path
          d="M 100 14 L 182 96 L 100 178 L 18 96 Z"
          stroke="#1C1917"
          strokeWidth="10"
          strokeLinejoin="miter"
          fill="none"
        />

        {/* Lower Diamond Center Crease */}
        <path
          d="M 100 142 L 100 178"
          stroke="#1C1917"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 68 126 L 100 142 L 132 126"
          stroke="#1C1917"
          strokeWidth="5"
          fill="none"
          strokeLinejoin="round"
        />

        {/* 2. Open Book Pages Background with Warm Glow */}
        {/* Left Page Surface */}
        <path
          d="M 98 48 C 82 40 60 42 50 48 L 50 120 C 60 114 82 114 98 128 Z"
          fill="url(#pageGradientLeft)"
        />
        {/* Right Page Surface */}
        <path
          d="M 102 48 C 118 40 140 42 150 48 L 150 120 C 140 114 118 114 102 128 Z"
          fill="url(#pageGradientRight)"
        />

        {/* Radiant Crease Glow Overlay */}
        <ellipse
          cx="100"
          cy="115"
          rx="45"
          ry="30"
          fill="url(#lumaGlow)"
        />

        {/* Lower Page Curving Underfold */}
        <path
          d="M 52 120 C 72 130 92 136 100 136 C 108 136 128 130 148 120 C 132 114 112 116 100 128 C 88 116 68 114 52 120 Z"
          fill="url(#underPageGlow)"
          opacity="0.9"
        />

        {/* Light Sunburst Rays Radiating from Crease */}
        <g stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
          <line x1="90" y1="110" x2="68" y2="84" />
          <line x1="94" y1="104" x2="78" y2="70" />
          <line x1="98" y1="100" x2="92" y2="60" />
        </g>

        {/* 3. The Stylized "L" & Book Outlines */}
        {/* Left Page "L" Spine/Stem */}
        <path
          d="M 50 26 L 68 26 L 68 108 L 100 126 L 100 136 L 50 112 Z"
          fill="#1C1917"
        />

        {/* Top Nib / Chevron Point between Pages */}
        <path
          d="M 100 48 L 94 40 C 97 60 97 85 100 102 C 103 85 103 60 106 40 Z"
          fill="#1C1917"
        />

        {/* Book Outer Page Contours */}
        {/* Left Page Top & Outer Stroke */}
        <path
          d="M 100 48 C 82 38 60 40 48 48 L 48 120 C 62 112 84 114 100 132"
          stroke="#1C1917"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Right Page Top & Outer Stroke */}
        <path
          d="M 100 48 C 118 38 140 40 152 48 L 152 120 C 138 112 116 114 100 132"
          stroke="#1C1917"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Lower Spine Underline */}
        <path
          d="M 48 120 C 72 134 94 138 100 138 C 106 138 128 134 152 120"
          stroke="#1C1917"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* Wordmark Text */}
      {showWordmark && (
        <span
          className="font-serif font-black tracking-tight mt-1 text-center"
          style={{
            color: wordmarkColor,
            fontSize: typeof size === "number" ? `${Math.max(16, size * 0.42)}px` : "1.75rem",
            letterSpacing: "-0.02em",
          }}
        >
          Luma
        </span>
      )}
    </div>
  );
};
