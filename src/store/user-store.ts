"use client";

import { create } from "zustand";
import type { UserPublic } from "@/types";

interface UserState {
  user: UserPublic | null;
  loading: boolean;
  setUser: (u: UserPublic | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  refresh: async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        set({ user: null, loading: false });
        return;
      }
      const data = await res.json();
      set({ user: data.user ?? null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    await fetch("/api/auth/me", {
      method: "DELETE",
      credentials: "include",
    });
    set({ user: null });
  },
}));
