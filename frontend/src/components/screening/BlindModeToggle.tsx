"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface BlindModeToggleProps {
  blindMode: boolean;
  setBlindMode: (val: boolean) => void;
}

export function BlindModeToggle({ blindMode, setBlindMode }: BlindModeToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <Switch 
        id="blind-mode" 
        checked={blindMode} 
        onCheckedChange={setBlindMode} 
        aria-label="Toggle blind mode"
      />
      <Label htmlFor="blind-mode" className="text-sm font-medium cursor-pointer">
        Blind mode
      </Label>
    </div>
  );
}
