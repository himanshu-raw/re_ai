"use client";

import { Candidate } from "@/types/screening";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale } from "lucide-react";

type ReviewStatus = "Shortlist" | "Maybe" | "Reject";

interface CompareViewProps {
  candidates: Candidate[];
  compareIds: Set<string>;
  blindMode: boolean;
  reviewStatuses: Record<string, ReviewStatus>;
  compareMessage: string;
  onBack: () => void;
  onToggleCompare: (id: string) => void;
  onSelectCandidate: (candidate: Candidate) => void;
}

export function CompareView({
  candidates,
  compareIds,
  blindMode,
  reviewStatuses,
  compareMessage,
  onBack,
  onToggleCompare,
  onSelectCandidate,
}: CompareViewProps) {
  const comparedCandidates = candidates.filter((candidate) => compareIds.has(candidate.id));
  const label = (candidate: Candidate) =>
    blindMode ? candidate.blindLabel : candidate.fileName;

  return (
    <section className="animate-rise-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Side-by-side review</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Compare candidates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose two or three candidates to compare their scores, must-have coverage, and evidence.
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-lg" onClick={onBack}>
          <ArrowLeft className="mr-2 size-4" />Back to candidates
        </Button>
      </div>

      <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Select candidates</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {compareIds.size} of 3 selected. The comparison appears when at least two are selected.
            </p>
          </div>
          <Scale className="size-5 text-primary" aria-hidden="true" />
        </div>

        {candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
            Analyze resumes before comparing candidates.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {candidates.map((candidate) => {
              const isSelected = compareIds.has(candidate.id);
              return (
                <article key={candidate.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-4">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => onSelectCandidate(candidate)}
                  >
                    <span className="block truncate font-medium hover:text-primary">{label(candidate)}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Match score: {candidate.score}/100
                    </span>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "secondary" : "outline"}
                    aria-pressed={isSelected}
                    disabled={!isSelected && compareIds.size >= 3}
                    onClick={() => onToggleCompare(candidate.id)}
                  >
                    {isSelected ? "Selected" : "Add"}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
        {compareMessage && <p role="status" className="mt-3 text-sm text-status-warn">{compareMessage}</p>}
        {candidates.length > 0 && comparedCandidates.length < 2 && (
          <p role="status" className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
            Select at least two candidates to see the side-by-side comparison.
          </p>
        )}
      </section>

      {comparedCandidates.length >= 2 && (
        <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-40 p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparison</th>
                {comparedCandidates.map((candidate) => (
                  <th key={candidate.id} className="min-w-[220px] p-4 align-top">
                    <button type="button" onClick={() => onSelectCandidate(candidate)} className="text-left font-semibold hover:text-primary">
                      {label(candidate)}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {reviewStatuses[candidate.id] && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{reviewStatuses[candidate.id]}</span>}
                      <button type="button" className="text-xs text-muted-foreground underline decoration-transparent hover:text-foreground hover:decoration-current" onClick={() => onToggleCompare(candidate.id)}>Remove</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              <tr>
                <th className="p-4 font-medium text-muted-foreground">Match score</th>
                {comparedCandidates.map((candidate) => (
                  <td key={candidate.id} className="p-4">
                    <span className={`text-2xl font-bold tabular-nums ${candidate.score >= 70 ? "text-status-ok" : candidate.score >= 40 ? "text-status-warn" : "text-status-bad"}`}>
                      {candidate.score}<span className="ml-1 text-xs font-medium text-muted-foreground">/ 100</span>
                    </span>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, candidate.score))}%` }} />
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <th className="p-4 font-medium text-muted-foreground">Must-have coverage</th>
                {comparedCandidates.map((candidate) => <td key={candidate.id} className="p-4 font-semibold tabular-nums">{candidate.mustHaveMet} / {candidate.mustHaveTotal}</td>)}
              </tr>
              <tr>
                <th className="p-4 font-medium text-muted-foreground">Confidence</th>
                {comparedCandidates.map((candidate) => <td key={candidate.id} className="p-4">{candidate.confidence}</td>)}
              </tr>
              <tr>
                <th className="p-4 font-medium text-muted-foreground">Review status</th>
                {comparedCandidates.map((candidate) => <td key={candidate.id} className="p-4">{reviewStatuses[candidate.id] ?? "Not reviewed"}</td>)}
              </tr>
              <tr>
                <th className="p-4 align-top font-medium text-muted-foreground">Summary</th>
                {comparedCandidates.map((candidate) => <td key={candidate.id} className="max-w-sm p-4 align-top leading-6 text-muted-foreground">{candidate.summary}</td>)}
              </tr>
              <tr>
                <th className="p-4 align-top font-medium text-muted-foreground">Skills</th>
                {comparedCandidates.map((candidate) => (
                  <td key={candidate.id} className="p-4 align-top">
                    <ul className="space-y-2">
                      {candidate.skills.map((skill) => (
                        <li key={skill.id} className="flex items-center justify-between gap-3">
                          <span>{skill.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${skill.status === "missing" ? "bg-status-bad-soft text-status-bad" : skill.status === "matched" ? "bg-status-ok-soft text-status-ok" : "bg-status-warn-soft text-status-warn"}`}>
                            {skill.status === "missing" ? "Missing" : skill.status === "matched" ? "Verified" : "Supported"}
                          </span>
                        </li>
                      ))}
                      {candidate.skills.length === 0 && <li className="text-muted-foreground">No skill cards in response.</li>}
                    </ul>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {comparedCandidates.length >= 2 && (
        <p className="text-xs text-muted-foreground">Comparison values come from the existing resume analysis response. AI scores are decision support only.</p>
      )}
    </section>
  );
}
