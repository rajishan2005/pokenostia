"use client";

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

interface Props extends HTMLMotionProps<"div"> {
  strong?: boolean;
  hover?: boolean;
}

export function GlassCard({
  className,
  strong,
  hover = true,
  children,
  ...rest
}: Props) {
  return (
    <motion.div
      whileHover={hover ? { y: -3, scale: 1.01 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "rounded-2xl p-5",
        strong ? "glass-strong" : "glass",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
