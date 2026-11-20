"use client";

import { useMemo, useState } from "react";
import { Candidate } from "@/types/screening";
import { ScoreBar } from "./ScoreBar";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowDownWideNarrow, GitCompareArrows, Search, Trash2 } from "lucide-react";

type ReviewStatus = "Shortlist" | "Maybe" | "Reject";
type CandidateFilter = "All" | "Meets all must-haves" | "Needs review";

interface CandidateTableProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
  selectedCandidateId?: string;
  blindMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean, visibleIds: string[]) => void;
  onRemove: (id: string) => void;
  compareIds: Set<string>;
  onToggleCompare: (id: string) => void;
  reviewStatuses: Record<string, ReviewStatus>;
  allowRemoval: boolean;
}

export function CandidateTable({
  candidates,
  onSelectCandidate,
  selectedCandidateId,
  blindMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRemove,
  compareIds,
  onToggleCompare,
  reviewStatuses,
  allowRemoval,
}: CandidateTableProps) {
  const [filter, setFilter] = useState<CandidateFilter>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"score" | "score-asc" | "name">("score");

  const sorted = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = candidates.filter((candidate) => {
      if (filter === "Meets all must-haves" && candidate.mustHaveMet !== candidate.mustHaveTotal) return false;
      if (filter === "Needs review" && !candidate.needsReview) return false;
      if (!query) return true;
      return (blindMode ? candidate.blindLabel : candidate.fileName).toLowerCase().includes(query);
    });

    return filtered.sort((a, b) => {
      if (sort === "score-asc") return a.score - b.score;
      if (sort === "name") return a.fileName.localeCompare(b.fileName);
      return b.score - a.score;
    });
  }, [blindMode, candidates, filter, search, sort]);

  const visibleIds = sorted.map((candidate) => candidate.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = visibleIds.some((id) => selectedIds.has(id));
  const label = (candidate: Candidate) => blindMode ? candidate.blindLabel : candidate.fileName;
  const readiness = (candidate: Candidate) =>
    candidate.mustHaveTotal > 0 && candidate.mustHaveMet === candidate.mustHaveTotal;

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["All", "Meets all must-haves", "Needs review"] as const).map((value) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              size="sm"
              className="shrink-0 rounded-full"
            >
              {value}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 xl:w-64 xl:flex-none">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search candidates"
              aria-label="Search candidates"
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          </div>
          <label className="relative">
            <span className="sr-only">Sort candidates</span>
            <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="h-9 w-[142px] appearance-none rounded-lg border border-input bg-card pl-9 pr-3 text-sm text-foreground"
              aria-label="Sort candidates"
            >
              <option value="score">Highest score</option>
              <option value="score-asc">Lowest score</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground"><Search className="size-5" /></div>
          <h3 className="font-semibold">{candidates.length ? "No candidates match" : "No candidates analyzed yet"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {candidates.length ? "Try changing the search or filters." : "Upload resumes and add a job description to start screening."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {sorted.map((candidate, index) => (
              <article
                key={candidate.id}
                className={`rounded-xl border border-border/80 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selectedCandidateId === candidate.id ? "ring-2 ring-primary/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {allowRemoval && (
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onCheckedChange={(checked) => onToggleSelect(candidate.id, !!checked)}
                      aria-label={`Select ${label(candidate)}`}
                    />
                  )}
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelectCandidate(candidate)}>
                    <span className="block truncate font-semibold">{label(candidate)}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Candidate {index + 1}</span>
                  </button>
                  <span className="tabular-nums text-lg font-bold">{candidate.score}<span className="ml-0.5 text-xs font-medium text-muted-foreground">%</span></span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfidenceBadge confidence={candidate.confidence} />
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${readiness(candidate) ? "bg-status-ok-soft text-status-ok" : "bg-status-warn-soft text-status-warn"}`}>
                      {candidate.mustHaveMet}/{candidate.mustHaveTotal} must-haves
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={compareIds.has(candidate.id) ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => onToggleCompare(candidate.id)}
                    aria-pressed={compareIds.has(candidate.id)}
                    aria-label={`${compareIds.has(candidate.id) ? "Remove from" : "Add to"} comparison`}
                  >
                    <GitCompareArrows className="size-4" />
                  </Button>
                </div>
                <ScoreBar score={candidate.score} />
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {allowRemoval && (
                      <th className="w-12 px-4 py-3">
                        <Checkbox
                          checked={allSelected || someSelected}
                          onCheckedChange={(checked) => onToggleSelectAll(!!checked, visibleIds)}
                          aria-label="Select all visible candidates"
                        />
                      </th>
                    )}
                    <th className="w-12 px-2 py-3 font-medium">#</th>
                    <th className="px-4 py-3 font-medium">Candidate</th>
                    <th className="w-48 px-4 py-3 font-medium">Match score</th>
                    <th className="w-36 px-4 py-3 font-medium">Must-haves</th>
                    <th className="w-32 px-4 py-3 font-medium">Confidence</th>
                    <th className="w-32 px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sorted.map((candidate, index) => (
                    <tr
                      key={candidate.id}
                      className={`transition-colors hover:bg-muted/40 ${selectedCandidateId === candidate.id ? "bg-primary/5" : ""}`}
                    >
                      {allowRemoval && (
                        <td className="px-4 py-4">
                          <Checkbox
                            checked={selectedIds.has(candidate.id)}
                            onCheckedChange={(checked) => onToggleSelect(candidate.id, !!checked)}
                            aria-label={`Select ${label(candidate)}`}
                          />
                        </td>
                      )}
                      <td className="px-2 py-4 tabular-nums text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-4">
                        <button type="button" className="text-left" onClick={() => onSelectCandidate(candidate)}>
                          <span className="block max-w-[260px] truncate font-semibold hover:text-primary">{label(candidate)}</span>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${readiness(candidate) ? "bg-status-ok-soft text-status-ok" : "bg-status-warn-soft text-status-warn"}`}>
                            {readiness(candidate) ? "All must-haves met" : "Review gaps"}
                          </span>
                          {reviewStatuses[candidate.id] && <span className="ml-2 text-xs text-muted-foreground">{reviewStatuses[candidate.id]}</span>}
                        </button>
                      </td>
                      <td className="cursor-pointer px-4 py-4" onClick={() => onSelectCandidate(candidate)}>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold tabular-nums">{candidate.score}</span>
                          <span className="text-xs text-muted-foreground">/ 100</span>
                        </div>
                        <ScoreBar score={candidate.score} />
                      </td>
                      <td className="px-4 py-4 font-medium tabular-nums">{candidate.mustHaveMet} / {candidate.mustHaveTotal}</td>
                      <td className="px-4 py-4"><ConfidenceBadge confidence={candidate.confidence} /></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button
                                type="button"
                                variant={compareIds.has(candidate.id) ? "secondary" : "ghost"}
                                size="icon"
                                onClick={() => onToggleCompare(candidate.id)}
                                aria-label={`${compareIds.has(candidate.id) ? "Remove from" : "Add to"} comparison`}
                              >
                                <GitCompareArrows className="size-4" />
                              </Button>
                            } />
                            <TooltipContent><p>{compareIds.has(candidate.id) ? "Remove from compare" : "Add to compare"}</p></TooltipContent>
                          </Tooltip>
                          <Button type="button" variant="ghost" size="sm" onClick={() => onSelectCandidate(candidate)}>View</Button>
                          {allowRemoval && (
                            <Tooltip>
                              <TooltipTrigger render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:bg-status-bad-soft hover:text-status-bad"
                                  onClick={() => onRemove(candidate.id)}
                                  aria-label={`Remove ${label(candidate)} from Overview`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              } />
                              <TooltipContent><p>Remove from Overview</p></TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
