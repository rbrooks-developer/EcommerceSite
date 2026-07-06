"use client";

import { useOptimistic, useTransition } from "react";
import { Sun, Moon } from "lucide-react";
import { saveThemePreference } from "@/lib/actions/profile";

export function ThemeToggle({ isDark }: { isDark: boolean }) {
  const [optimisticDark, setOptimisticDark] = useOptimistic(isDark);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimisticDark;
    startTransition(async () => {
      setOptimisticDark(next);
      // Update DOM immediately — no waiting for server round-trip
      const wrapper = document.querySelector("[data-admin-theme]");
      if (wrapper) wrapper.setAttribute("data-admin-theme", next ? "dark" : "light");
      await saveThemePreference(next ? "dark" : "light");
    });
  }

  return (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      aria-label={optimisticDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {optimisticDark ? (
        <Sun className="h-4 w-4 shrink-0" />
      ) : (
        <Moon className="h-4 w-4 shrink-0" />
      )}
      {optimisticDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
