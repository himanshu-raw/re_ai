"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const currentTheme = theme === 'system' ? resolvedTheme : theme;
  const isDark = currentTheme === "dark";

  if (!mounted) {
    return <Button variant="outline" size="sm" className="w-9 h-9 px-0" aria-label="Toggle color theme" />;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-9 h-9 px-0"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
