import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (value: boolean) => void;
  setMobileOpen: (value: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      isMobileOpen: false,
      toggleCollapsed: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
      setCollapsed: (value) => set({ isCollapsed: value }),
      setMobileOpen: (value) => set({ isMobileOpen: value }),
    }),
    {
      name: "aat-sidebar",
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    }
  )
);
