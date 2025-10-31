import { create } from "zustand";

export const useThemeStore = create((set) => ({
  theme: localStorage.getItem("langbridge-theme") || "night",
  setTheme: (theme) => {
    localStorage.setItem("langbridge-theme", theme);
    set({ theme });
  },
}));