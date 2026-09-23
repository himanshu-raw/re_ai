"use client";

import { useState } from "react";
import { Candidate } from "@/types/screening";
import { ScoreBar } from "./ScoreBar";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";

interface CandidateTableProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
  selectedCandidateId?: string;
  blindMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onRemove: (id: string) => void;
}

export function CandidateTable({ 
  candidates, 
  onSelectCandidate, 
  selectedCandidateId, 
  blindMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRemove
}: CandidateTableProps) {
  const [filter, setFilter] = useState<"All" | "Meets all must-haves" | "Needs review">("All");

  const filtered = candidates.filter((c) => {
    if (filter === "Meets all must-haves") return c.mustHaveMet === c.mustHaveTotal;
    if (filter === "Needs review") return c.needsReview;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => b.score - a.score);
  const visibleIds = sorted.map(c => c.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const someSelected = visibleIds.some(id => selectedIds.has(id));

  return (
    <div className="mt-4 font-sans">
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
        {(["All", "Meets all must-haves", "Needs review"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            size="sm"
            className="rounded-full"
          >
            {f}
          </Button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
          No candidates match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border text-muted-foreground font-medium">
              <tr>
                <th className="px-4 py-3 w-10 font-normal">
                  <Checkbox 
                    checked={(allSelected ? true : someSelected ? "indeterminate" : false) as any}
                    onCheckedChange={(c) => onToggleSelectAll(!!c, visibleIds)}
                    aria-label="Select all candidates"
                  />
                </th>
                <th className="px-2 py-3 w-12 font-normal">#</th>
                <th className="px-4 py-3 font-normal">Candidate</th>
                <th className="px-4 py-3 w-48 font-normal">Match score</th>
                <th className="px-4 py-3 w-32 font-normal">Must-haves</th>
                <th className="px-4 py-3 w-32 font-normal">Confidence</th>
                <th className="px-4 py-3 w-40 font-normal text-right"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cand, idx) => (
                <tr 
                  key={cand.id} 
                  className={`border-b border-border hover:bg-muted/30 transition-colors ${selectedCandidateId === cand.id ? 'bg-muted/50' : ''}`}
                >
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={selectedIds.has(cand.id)}
                      onCheckedChange={(c) => onToggleSelect(cand.id, !!c)}
                      aria-label={`Select ${blindMode ? cand.blindLabel : cand.fileName}`}
                    />
                  </td>
                  <td 
                    className="px-2 py-4 cursor-pointer"
                    onClick={() => onSelectCandidate(cand)}
                  >
                    {idx + 1}
                  </td>
                  <td 
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => onSelectCandidate(cand)}
                  >
                    <div className="font-semibold text-foreground">
                      {blindMode ? cand.blindLabel : cand.fileName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {cand.mustHaveMet === cand.mustHaveTotal ? "Ready to shortlist" : "Missing must-haves"}
                    </div>
                  </td>
                  <td 
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => onSelectCandidate(cand)}
                  >
                    <div className="font-bold text-lg">{cand.score}</div>
                    <ScoreBar score={cand.score} />
                  </td>
                  <td 
                    className="px-4 py-4 text-foreground font-medium cursor-pointer"
                    onClick={() => onSelectCandidate(cand)}
                  >
                    {cand.mustHaveMet} of {cand.mustHaveTotal}
                  </td>
                  <td 
                    className="px-4 py-4 cursor-pointer"
                    onClick={() => onSelectCandidate(cand)}
                  >
                    <ConfidenceBadge confidence={cand.confidence} />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => onSelectCandidate(cand)}>
                        View evidence
                      </Button>
                      <Tooltip>
                        <TooltipTrigger render={
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="w-9 h-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove(cand.id);
                            }}
                            aria-label={`Remove ${blindMode ? cand.blindLabel : cand.fileName}`}
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </Button>
                        } />
                        <TooltipContent>
                          <p>Remove resume</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
