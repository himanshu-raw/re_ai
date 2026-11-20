"use client";

import { useEffect, useRef } from "react";
import { Candidate } from "@/types/screening";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Trash2 } from "lucide-react";

export type ReviewStatus = "Shortlist" | "Maybe" | "Reject";

interface EvidenceViewerProps {
  candidate: Candidate;
  blindMode: boolean;
  onClose: () => void;
  selectedSkillId: number | null;
  setSelectedSkillId: (id: number | null) => void;
  onRemove: (id: string) => void;
  reviewStatus?: ReviewStatus;
  onSetReviewStatus: (status: ReviewStatus) => void;
  note: string;
  onNoteChange: (note: string) => void;
}

function ScoreRing({ score }: { score: number }) {
  const scoreColor = score >= 70 ? "var(--status-ok)" : score >= 40 ? "var(--status-warn)" : "var(--status-bad)";
  return (
    <div
      className="grid size-[76px] shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(${scoreColor} ${score * 3.6}deg, var(--muted) 0deg)` }}
      aria-label={`Match score ${score} out of 100`}
      role="img"
    >
      <div className="grid size-[62px] place-items-center rounded-full bg-card text-xl font-bold tabular-nums">
        {Math.round(score)}<span className="sr-only"> percent</span>
      </div>
    </div>
  );
}

export function EvidenceViewer({
  candidate,
  blindMode,
  onClose,
  selectedSkillId,
  setSelectedSkillId,
  onRemove,
  reviewStatus,
  onSetReviewStatus,
  note,
  onNoteChange,
}: EvidenceViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const resumeEvidenceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const candidateLabel = blindMode ? candidate.blindLabel : candidate.fileName;
  const revealSkillEvidence = (skillId: number) => {
    setSelectedSkillId(skillId);
    const evidence = resumeEvidenceRef.current?.querySelector<HTMLElement>(
      `[data-skill-evidence-id="${skillId}"]`,
    );
    (evidence ?? resumeEvidenceRef.current)?.scrollIntoView({
      behavior: "smooth",
      block: evidence ? "center" : "start",
    });
  };
  const scoreFactors = [
    { key: "Evidence", getValue: (skill: Candidate["skills"][number]) => skill.evidenceScore },
    { key: "Freshness", getValue: (skill: Candidate["skills"][number]) => skill.freshness },
    { key: "Project", getValue: (skill: Candidate["skills"][number]) => skill.projectScore },
    { key: "Combined", getValue: (skill: Candidate["skills"][number]) => skill.combinedScore },
  ];

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close candidate details"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-detail-title"
        className="animate-rise-in absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-border bg-background shadow-2xl"
      >
        <header className="flex items-start gap-4 border-b border-border bg-card px-5 py-5 sm:px-7">
          <ScoreRing score={candidate.score} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">Candidate review</span>
              <ConfidenceBadge confidence={candidate.confidence} />
            </div>
            <h2 id="candidate-detail-title" className="mt-2 truncate text-xl font-semibold tracking-tight">{candidateLabel}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{candidate.mustHaveMet} of {candidate.mustHaveTotal} must-have skills met</p>
          </div>
          <Button ref={closeRef} variant="ghost" size="icon" onClick={onClose} aria-label="Close candidate details">
            <X className="size-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="grid min-h-full grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
            <section ref={resumeEvidenceRef} className="border-b border-border p-5 sm:p-7 xl:border-b-0 xl:border-r" aria-labelledby="resume-text-heading">
              <div className="mb-4">
                <h3 id="resume-text-heading" className="font-semibold">Resume evidence</h3>
                <p className="mt-1 text-xs text-muted-foreground">Select highlighted text to inspect its related skill.</p>
              </div>
              {candidate.sections.length === 0 ? (
                <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No parsed resume text was returned.</p>
              ) : (
                <div className="space-y-5">
                  {candidate.sections.map((section) => (
                    <section key={section.title} aria-label={section.title}>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h4>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                        {section.segments.map((segment, index) => {
                          if (segment.isPii && blindMode) {
                            return <span key={index} className="rounded bg-foreground px-1 text-background">&lt;{segment.piiType}&gt;</span>;
                          }
                          if (segment.skillId) {
                            const selected = segment.skillId === selectedSkillId;
                            const skill = candidate.skills.find((item) => item.id === segment.skillId);
                            return (
                              <button
                                type="button"
                                key={`${segment.skillId}-${index}`}
                                data-skill-evidence-id={segment.skillId}
                                onClick={() => setSelectedSkillId(segment.skillId ?? null)}
                                className={`rounded px-1 text-left transition-colors ${selected ? "bg-amber-300 text-slate-950 ring-1 ring-amber-500" : "bg-amber-100 text-slate-900 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-50"}`}
                                aria-label={`Evidence for ${skill?.name ?? "skill"}`}
                              >
                                {segment.text}
                              </button>
                            );
                          }
                          return <span key={index}>{segment.text}</span>;
                        })}
                      </p>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-6 p-5 sm:p-7" aria-label="Candidate evaluation">
              <div>
                <h3 className="font-semibold">Evaluation summary</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{candidate.summary}</p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Skill breakdown</h3>
                  <span className="text-xs text-muted-foreground">From analysis</span>
                </div>
                {candidate.skills.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No skill breakdown was included in the analysis response.</p>
                ) : (
                  <div className="space-y-2">
                    {candidate.skills.map((skill) => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => revealSkillEvidence(skill.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-all hover:border-primary/40 ${selectedSkillId === skill.id ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border bg-card"}`}
                        aria-pressed={selectedSkillId === skill.id}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium">{skill.name}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${skill.status === "missing" ? "bg-status-bad-soft text-status-bad" : skill.status === "matched" ? "bg-status-ok-soft text-status-ok" : "bg-status-warn-soft text-status-warn"}`}>
                            {skill.status === "missing" ? "Missing" : skill.status === "matched" ? "Verified" : "Supported"}
                          </span>
                        </div>
                        {scoreFactors.some(({ getValue }) => getValue(skill) !== undefined) ? (
                          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                            {scoreFactors.map(({ key, getValue }) => {
                              const value = getValue(skill);
                              if (value === undefined) return null;
                              return (
                                <div key={key}>
                                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>{key}</span><span className="tabular-nums">{Math.round(value * 100)}%</span></div>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">{skill.note || "No additional evidence details."}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-3 font-semibold">Review decision</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(["Shortlist", "Maybe", "Reject"] as const).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={reviewStatus === status ? "default" : "outline"}
                      className="w-full min-w-0 justify-center gap-0.5 rounded-lg px-2 text-[11px] leading-5"
                      onClick={() => onSetReviewStatus(status)}
                      aria-pressed={reviewStatus === status}
                    >
                      {status === "Shortlist" && (
                        <span className="grid size-4 shrink-0 place-items-center">
                          <Check aria-hidden="true" className="size-3" />
                        </span>
                      )}
                      {status}
                    </Button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Decision is stored in this page session only.</p>
              </div>

              <div>
                <label htmlFor="candidate-note" className="mb-2 block text-sm font-semibold">Reviewer notes</label>
                <Textarea
                  id="candidate-note"
                  value={note}
                  onChange={(event) => onNoteChange(event.target.value)}
                  placeholder="Add a private note for this review..."
                  className="min-h-24 resize-y rounded-xl bg-card"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Notes are kept in page state and are not sent to the API.</p>
              </div>

              <Button type="button" variant="ghost" className="w-full justify-start text-status-bad hover:bg-status-bad-soft hover:text-status-bad" onClick={() => onRemove(candidate.id)}>
                <Trash2 className="mr-2 size-4" />
                Remove resume
              </Button>
            </section>
          </div>
        </div>
        <footer className="border-t border-border bg-card px-5 py-3 text-center text-xs text-muted-foreground">
          AI scores support recruiter review; they do not make hiring decisions.
        </footer>
      </aside>
    </div>
  );
}
