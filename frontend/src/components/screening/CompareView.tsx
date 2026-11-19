"use client";

import { Candidate } from "@/types/screening";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale } from "lucide-react";

type ReviewStatus = "Shortlist" | "Maybe" | "Reject";

interface CompareViewProps {
  candidates: Candidate[];
  blindMode: boolean;
  reviewStatuses: Record<string, ReviewStatus>;
  onBack: () => void;
  onRemoveFromCompare: (id: string) => void;
  onSelectCandidate: (candidate: Candidate) => void;
}

export function CompareView({
  candidates,
  blindMode,
  reviewStatuses,
  onBack,
  onRemoveFromCompare,
  onSelectCandidate,
}: CompareViewProps) {
  if (candidates.length < 2) {
    return (
      <section className="animate-rise-in rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Scale className="size-5" /></div>
        <h2 className="text-lg font-semibold">Compare candidates side by side</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Select two or three candidates from the ranked list to compare their API-provided scores, must-have coverage, and evidence.
        </p>
        <Button type="button" className="mt-5 rounded-lg" onClick={onBack}><ArrowLeft className="mr-2 size-4" />Back to candidates</Button>
      </section>
    );
  }

  return (
    <section className="animate-rise-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Side-by-side</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Candidate comparison</h2>
          <p className="mt-1 text-sm text-muted-foreground">{candidates.length} candidates selected</p>
        </div>
        <Button type="button" variant="outline" className="rounded-lg" onClick={onBack}><ArrowLeft className="mr-2 size-4" />Back to candidates</Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/80 bg-card shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="w-40 p-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comparison</th>
              {candidates.map((candidate) => (
                <th key={candidate.id} className="min-w-[220px] p-4 align-top">
                  <button type="button" onClick={() => onSelectCandidate(candidate)} className="text-left font-semibold hover:text-primary">
                    {blindMode ? candidate.blindLabel : candidate.fileName}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {reviewStatuses[candidate.id] && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">{reviewStatuses[candidate.id]}</span>}
                    <button type="button" className="text-xs text-muted-foreground underline decoration-transparent hover:text-foreground hover:decoration-current" onClick={() => onRemoveFromCompare(candidate.id)}>Remove</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            <tr>
              <th className="p-4 font-medium text-muted-foreground">Match score</th>
              {candidates.map((candidate) => (
                <td key={candidate.id} className="p-4">
                  <span className={`text-2xl font-bold tabular-nums ${candidate.score >= 70 ? "text-status-ok" : candidate.score >= 40 ? "text-status-warn" : "text-status-bad"}`}>{candidate.score}<span className="ml-1 text-xs font-medium text-muted-foreground">/ 100</span></span>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, candidate.score))}%` }} /></div>
                </td>
              ))}
            </tr>
            <tr>
              <th className="p-4 font-medium text-muted-foreground">Must-have coverage</th>
              {candidates.map((candidate) => <td key={candidate.id} className="p-4 font-semibold tabular-nums">{candidate.mustHaveMet} / {candidate.mustHaveTotal}</td>)}
            </tr>
            <tr>
              <th className="p-4 font-medium text-muted-foreground">Confidence</th>
              {candidates.map((candidate) => <td key={candidate.id} className="p-4">{candidate.confidence}</td>)}
            </tr>
            <tr>
              <th className="p-4 font-medium text-muted-foreground">Review status</th>
              {candidates.map((candidate) => <td key={candidate.id} className="p-4">{reviewStatuses[candidate.id] ?? "Not reviewed"}</td>)}
            </tr>
            <tr>
              <th className="p-4 align-top font-medium text-muted-foreground">Summary</th>
              {candidates.map((candidate) => <td key={candidate.id} className="max-w-sm p-4 align-top leading-6 text-muted-foreground">{candidate.summary}</td>)}
            </tr>
            <tr>
              <th className="p-4 align-top font-medium text-muted-foreground">Skills</th>
              {candidates.map((candidate) => (
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
      <p className="text-xs text-muted-foreground">Comparison values come from the existing resume analysis response. AI scores are decision support only.</p>
    </section>
  );
}
