"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

interface Props extends HTMLMotionProps<"button"> {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        size === "sm" && "px-3 py-1.5 text-sm",
        size === "md" && "px-5 py-2.5 text-sm",
        size === "lg" && "px-7 py-3.5 text-base",
        variant === "primary" && "btn-primary text-white",
        variant === "ghost" && "btn-ghost text-white",
        variant === "danger" &&
          "bg-rose-600/80 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/30",
        className
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
