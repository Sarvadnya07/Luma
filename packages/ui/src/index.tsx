import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = "primary",
  size = "md",
  children,
  ...props
}) => {
  const base = "inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-stone-400/40 disabled:opacity-50 disabled:pointer-events-none select-none";
  const variants = {
    primary: "bg-[#18181B] hover:bg-[#27272A] active:bg-[#09090B] text-white shadow-sm rounded-lg",
    secondary: "bg-[#EFEAE1] hover:bg-[#E5DFD4] text-[#1C1917] border border-[#DDD5C7] rounded-lg",
    outline: "bg-transparent hover:bg-[#EFEAE1] text-[#1C1917] border border-[#D8D0C3] rounded-lg",
    ghost: "hover:bg-[#EFEAE1] text-[#57534E] hover:text-[#1C1917] rounded-lg",
    danger: "bg-rose-600 hover:bg-rose-700 text-white rounded-lg",
  };
  const sizes = {
    xs: "px-2 py-1 text-[11px]",
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "stone" | "success" | "warning" | "error";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const variants = {
    default: "bg-[#EFEAE1] text-[#57534E] border-[#DDD5C7]",
    stone: "bg-[#E5DFD4] text-[#292524] border-[#D6CEC2]",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border font-mono tracking-tight",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export * from "./LumaLogo";


