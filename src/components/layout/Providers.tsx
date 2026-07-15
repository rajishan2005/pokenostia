"use client";

import { type ReactNode, useEffect } from "react";
import { Particles } from "@/components/ui/Particles";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <>
      <Particles density={40} />
      <div className="relative z-10 min-h-dvh">{children}</div>
    </>
  );
}
