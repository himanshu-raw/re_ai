"use client";

import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  onRemove: () => void;
}

export function BulkActionsBar({ selectedCount, onClear, onRemove }: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-3 rounded-md flex items-center justify-between mb-4 shadow-sm animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-4">
        <span className="font-medium">{selectedCount} selected</span>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={onClear}
          className="h-8 bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
        >
          <X className="w-4 h-4 mr-1.5" />
          Clear selection
        </Button>
      </div>
      <Button 
        variant="destructive" 
        size="sm" 
        onClick={onRemove}
        className="h-8 shadow-none"
      >
        <Trash2 className="w-4 h-4 mr-1.5" />
        Remove selected
      </Button>
    </div>
  );
}
