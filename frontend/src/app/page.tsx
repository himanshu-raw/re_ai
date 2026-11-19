"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Download,
  FileCheck2,
  Files,
  GitCompareArrows,
  LayoutDashboard,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { UploadCard, UploadFileState } from "@/components/screening/UploadCard";
import { JobDescriptionCard } from "@/components/screening/JobDescriptionCard";
import { CandidateTable } from "@/components/screening/CandidateTable";
import { EvidenceViewer, ReviewStatus } from "@/components/screening/EvidenceViewer";
import { BlindModeToggle } from "@/components/screening/BlindModeToggle";
import { ThemeToggle } from "@/components/screening/ThemeToggle";
import { CompareView } from "@/components/screening/CompareView";
import { Candidate } from "@/types/screening";
import { adaptBackendResultsToCandidates } from "@/lib/backend-adapter";
import { RemoveResumeDialog } from "@/components/screening/RemoveResumeDialog";
import { BulkActionsBar } from "@/components/screening/BulkActionsBar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type WorkspaceView = "overview" | "candidates" | "compare";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "candidates", label: "Candidates", icon: UsersRound },
  { id: "compare", label: "Compare", icon: GitCompareArrows },
] as const;

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "default" | "green" | "amber";
}) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${tone === "green" ? "bg-status-ok-soft text-status-ok" : tone === "amber" ? "bg-status-warn-soft text-status-warn" : "bg-primary/10 text-primary"}`}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function CandidateSkeletons() {
  return (
    <div className="space-y-3" aria-label="Analyzing resumes" aria-live="polite">
      {[0, 1, 2].map((item) => (
        <div key={item} className="animate-pulse rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="size-4 rounded bg-muted" />
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="ml-auto h-4 w-16 rounded bg-muted" />
          </div>
          <div className="mt-4 h-2 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

function exportCsv(candidates: Candidate[], blindMode: boolean) {
  const headers = ["Candidate", "Match score", "Must-haves met", "Must-haves total", "Confidence", "Summary"];
  const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = candidates.map((candidate) => [
    blindMode ? candidate.blindLabel : candidate.fileName,
    candidate.score,
    candidate.mustHaveMet,
    candidate.mustHaveTotal,
    candidate.confidence,
    candidate.summary,
  ]);
  const content = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "shortlisted-candidates.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hiddenFromOverviewIds, setHiddenFromOverviewIds] = useState<Set<string>>(new Set());
  const [jobDescription, setJobDescription] = useState("");
  const [blindMode, setBlindMode] = useState(false);
  const [view, setView] = useState<WorkspaceView>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareMessage, setCompareMessage] = useState("");
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);

  const handleAnalyze = async (jd: string, requiredSkills: string[], preferredSkills: string[]) => {
    if (files.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const jdForAnalysis = jd.trim() || [
      requiredSkills.length ? `Required skills: ${requiredSkills.join(", ")}.` : "",
      preferredSkills.length ? `Preferred skills: ${preferredSkills.join(", ")}.` : "",
    ].filter(Boolean).join(" ");
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file.file));
    formData.append("jd", jdForAnalysis);
    formData.append("required_skills", JSON.stringify(requiredSkills));
    formData.append("preferred_skills", JSON.stringify(preferredSkills));

    try {
      let response: Response;
      try {
        response = await fetch(`${apiBaseUrl}/api/v1/upload-resumes`, {
          method: "POST",
          body: formData,
        });
      } catch {
        throw new Error(`Could not reach the analysis API at ${apiBaseUrl}. Check that the backend is running and accessible from this browser.`);
      }
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Analysis failed with status ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data.results)) {
        throw new Error("The resume API returned an invalid response.");
      }
      const adapted = adaptBackendResultsToCandidates(data.results, candidates.length);
      setCandidates((previous) => [...previous, ...adapted]);
      setJobDescription(jd);
      setFiles([]);
      setView("candidates");
    } catch (error) {
      console.error("Analysis failed", error);
      setAnalysisError(error instanceof Error ? error.message : "Something went wrong while analyzing resumes.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean, visibleIds: string[]) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      visibleIds.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  };

  const handleToggleCompare = (id: string) => {
    setCompareMessage("");
    if (compareIds.has(id)) {
      setCompareIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
    } else if (compareIds.size < 3) {
      setCompareIds((previous) => new Set(previous).add(id));
    } else {
      setCompareMessage("Compare up to three candidates at a time.");
    }
  };

  const promptRemove = (ids: string[]) => {
    setPendingRemovalIds(ids);
    setIsDialogOpen(true);
  };

  const confirmRemove = () => {
    const idsToHide = new Set(pendingRemovalIds);
    setHiddenFromOverviewIds((previous) => new Set([...previous, ...idsToHide]));
    setSelectedIds((previous) => new Set([...previous].filter((id) => !idsToHide.has(id))));
    const label = getDialogLabel();
    toast.success(`${label} removed from Overview.`);
    setIsDialogOpen(false);
    setPendingRemovalIds([]);
  };

  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId);
  const overviewCandidates = candidates.filter((candidate) => !hiddenFromOverviewIds.has(candidate.id));
  const comparedCandidates = useMemo(
    () => candidates.filter((candidate) => compareIds.has(candidate.id)),
    [candidates, compareIds],
  );
  const shortlist = candidates.filter((candidate) => reviewStatuses[candidate.id] === "Shortlist");
  const needsReview = candidates.filter((candidate) => candidate.needsReview).length;
  const averageScore = candidates.length
    ? Math.round(candidates.reduce((total, candidate) => total + candidate.score, 0) / candidates.length)
    : 0;
  const jobTitle = jobDescription.split(/[.!?\n]/)[0]?.trim() || "Resume screening";

  const openSetup = () => {
    setView("overview");
    window.setTimeout(() => document.getElementById("screening-setup")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const navTo = (nextView: WorkspaceView) => {
    if (nextView === "compare" && compareIds.size < 2) {
      setCompareMessage("Select two or three candidates from the list to compare them.");
      setView("candidates");
      return;
    }
    setCompareMessage("");
    setView(nextView);
  };

  const getDialogLabel = () => {
    if (pendingRemovalIds.length === 1) {
      const candidate = candidates.find((item) => item.id === pendingRemovalIds[0]);
      return blindMode ? candidate?.blindLabel || "Candidate" : candidate?.fileName || "Resume";
    }
    return `${pendingRemovalIds.length} resumes`;
  };

  return (
    <div className="min-h-screen bg-background">
      <RemoveResumeDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={confirmRemove}
        label={getDialogLabel()}
        isBulk={pendingRemovalIds.length > 1}
        isRemoving={false}
      />

      <aside className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/80 bg-card/80 py-5 backdrop-blur-xl transition-[width] duration-200 lg:flex ${sidebarCollapsed ? "w-[76px] px-3" : "w-[248px] px-4"}`}>
        <button type="button" className={`mb-9 flex items-center gap-3 text-left ${sidebarCollapsed ? "justify-center px-0" : "px-2"}`} onClick={() => navTo("overview")} aria-label="ReAI overview">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-5" /></span>
          {!sidebarCollapsed && <span><span className="block text-lg font-bold tracking-tight">re.ai</span><span className="block text-[11px] text-muted-foreground">Recruiter workspace</span></span>}
        </button>
        {!sidebarCollapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>}
        <nav className="space-y-1" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => navTo(id)}
              aria-current={view === id ? "page" : undefined}
              title={sidebarCollapsed ? label : undefined}
              className={`flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors ${sidebarCollapsed ? "justify-center px-0" : "px-3"} ${view === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <Icon className="size-[18px]" />
              {!sidebarCollapsed && label}
              {!sidebarCollapsed && id === "candidates" && candidates.length > 0 && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{candidates.length}</span>}
              {!sidebarCollapsed && id === "compare" && compareIds.size > 0 && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs tabular-nums text-primary">{compareIds.size}</span>}
            </button>
          ))}
        </nav>
        <div className={`mt-auto rounded-xl border border-border/80 bg-muted/50 ${sidebarCollapsed ? "mx-auto p-2" : "p-3"}`} title={sidebarCollapsed ? "Human-led decision support" : undefined}>
            <div className={`flex items-center gap-2 text-xs font-semibold ${sidebarCollapsed ? "justify-center" : ""}`}><ShieldCheck className="size-4 shrink-0 text-status-ok" />{!sidebarCollapsed && "Human-led decisions"}</div>
          {!sidebarCollapsed && <p className="mt-2 text-[11px] leading-5 text-muted-foreground">AI scores are decision support, not automated hiring decisions.</p>}
        </div>
      </aside>

      <div className={`min-h-screen transition-[padding] duration-200 ${sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-[248px]"}`}>
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/80 bg-background/85 px-4 backdrop-blur-xl sm:px-7">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="hidden size-8 lg:inline-flex"
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
              </Button>
              <p className="text-[11px] font-medium text-muted-foreground">RECRUITER WORKSPACE <ChevronRight className="mx-1 inline size-3" />{view === "overview" ? "OVERVIEW" : view === "compare" ? "COMPARE" : "CANDIDATES"}</p>
            </div>
            <p className="mt-0.5 truncate text-sm font-semibold">{view === "overview" ? "Screening workspace" : view === "compare" ? "Compare candidates" : jobTitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border-r border-border pr-2 sm:pr-3"><BlindModeToggle blindMode={blindMode} setBlindMode={setBlindMode} /></div>
            <ThemeToggle />
            {shortlist.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="hidden rounded-lg sm:inline-flex" onClick={() => exportCsv(shortlist, blindMode)}>
                <Download className="mr-2 size-4" />Export shortlist
              </Button>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-7 lg:px-9">
          {analysisError && (
            <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-status-bad/30 bg-status-bad-soft px-4 py-3 text-sm text-status-bad">
              <div><p className="font-semibold">Analysis couldn’t be completed</p><p className="mt-1 break-words text-xs">{analysisError}</p></div>
              <button type="button" className="rounded p-1 font-semibold" onClick={() => setAnalysisError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}

          {view === "overview" && candidates.length === 0 && (
            <section className="animate-rise-in">
              <div className="overflow-hidden rounded-[28px] bg-[#17182a] text-white shadow-xl shadow-indigo-950/10 dark:bg-[#1c1c31]">
                <div className="grid gap-8 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-14">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-indigo-100"><Sparkles className="size-3.5 text-indigo-300" />Evidence-first candidate screening</span>
                    <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Find the right evidence.<br /><span className="text-indigo-300">Make the call yourself.</span></h1>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Compare resume evidence against a role’s requirements and review every score with confidence.</p>
                    <Button type="button" className="mt-7 rounded-xl bg-indigo-400 px-5 text-indigo-950 hover:bg-indigo-300" onClick={openSetup}>
                      Start a screening <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {[
                      { number: "01", title: "Add the role", text: "Paste a job description and tune the skills." },
                      { number: "02", title: "Upload resumes", text: "Bring in PDF, DOCX, or TXT files." },
                      { number: "03", title: "Review evidence", text: "Compare scores, inspect proof, and decide." },
                    ].map((step) => (
                      <div key={step.number} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                        <span className="text-xs font-semibold tracking-widest text-indigo-300">{step.number}</span>
                        <div><h2 className="text-sm font-semibold">{step.title}</h2><p className="mt-1 text-xs leading-5 text-slate-300">{step.text}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="my-8 grid gap-4 md:grid-cols-3">
                {[
                  { icon: BriefcaseBusiness, title: "Define the role", text: "Use the job details and set must-have or nice-to-have skills." },
                  { icon: Files, title: "Add candidates", text: "Upload one or more resumes in a single screening." },
                  { icon: FileCheck2, title: "Review with context", text: "See evidence behind each match and make your own decision." },
                ].map(({ icon: Icon, title, text }) => (
                  <article key={title} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-[18px]" /></span>
                    <h2 className="mt-4 font-semibold">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                  </article>
                ))}
              </div>

              <section id="screening-setup" className="scroll-mt-24">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">New screening</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">Set up your review</h2>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  <UploadCard files={files} setFiles={setFiles} />
                  <JobDescriptionCard onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} hasFiles={files.length > 0} />
                </div>
                {isAnalyzing && <div className="mt-6"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><LoaderCircle className="size-4 animate-spin text-primary" />Analyzing resumes — this may take a little while</div><CandidateSkeletons /></div>}
              </section>
            </section>
          )}

          {view === "overview" && candidates.length > 0 && (
            <section className="animate-rise-in space-y-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Current screening</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">{jobTitle}</h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{jobDescription || "Review candidates from this analysis."}</p>
                </div>
                <Button type="button" className="rounded-lg" onClick={() => navTo("candidates")}>View candidates <ArrowRight className="ml-2 size-4" /></Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Candidates analyzed" value={candidates.length} detail={hiddenFromOverviewIds.size > 0 ? `${hiddenFromOverviewIds.size} hidden from Overview` : "From the current page session"} icon={UsersRound} />
                <MetricCard label="Shortlisted" value={shortlist.length} detail="Based on your review decisions" icon={Check} tone="green" />
                <MetricCard label="Needs review" value={needsReview} detail="Candidates flagged for closer review" icon={Search} tone="amber" />
                <MetricCard label="Average match" value={`${averageScore}%`} detail="Average score from the analysis response" icon={Sparkles} />
              </div>
              <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div><h2 className="font-semibold">Ranked candidates</h2><p className="mt-1 text-sm text-muted-foreground">Highest match first</p></div>
                  <div className="flex gap-2">
                    {shortlist.length > 0 && <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => exportCsv(shortlist, blindMode)}><Download className="mr-2 size-4" />Export shortlist</Button>}
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={openSetup}>Add resumes</Button>
                  </div>
                </div>
                {selectedIds.size > 0 && (
                  <BulkActionsBar selectedCount={selectedIds.size} onClear={() => setSelectedIds(new Set())} onRemove={() => promptRemove(Array.from(selectedIds))} />
                )}
                {isAnalyzing ? <CandidateSkeletons /> : overviewCandidates.length > 0 ? (
                  <CandidateTable
                    candidates={overviewCandidates}
                    onSelectCandidate={(candidate) => { setSelectedCandidateId(candidate.id); setSelectedSkillId(null); }}
                    selectedCandidateId={selectedCandidateId}
                    blindMode={blindMode}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onRemove={(id) => promptRemove([id])}
                    compareIds={compareIds}
                    onToggleCompare={handleToggleCompare}
                    reviewStatuses={reviewStatuses}
                    allowRemoval
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                    <h3 className="font-semibold">All candidates are hidden from Overview</h3>
                    <p className="mt-1 text-sm text-muted-foreground">They remain available in Candidates and Compare.</p>
                    <Button type="button" variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => navTo("candidates")}>View candidates</Button>
                  </div>
                )}
              </section>
            </section>
          )}

          {view === "candidates" && (
            <section className="animate-rise-in space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Job detail</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">{jobTitle}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{jobDescription || "Candidates analyzed in this page session."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {shortlist.length > 0 && <Button type="button" variant="outline" className="rounded-lg" onClick={() => exportCsv(shortlist, blindMode)}><Download className="mr-2 size-4" />Export shortlist</Button>}
                  <Button type="button" variant="outline" className="rounded-lg" onClick={openSetup}>Add resumes</Button>
                  <Button type="button" variant="default" className="rounded-lg" onClick={() => navTo("compare")}><GitCompareArrows className="mr-2 size-4" />Compare {compareIds.size > 0 ? `(${compareIds.size})` : ""}</Button>
                </div>
              </div>

              {compareMessage && <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">{compareMessage}</p>}

              <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6">
                <div className="mb-2 flex items-center justify-between">
                  <div><h2 className="font-semibold">Ranked candidates</h2><p className="mt-1 text-sm text-muted-foreground">{candidates.length} resume{candidates.length === 1 ? "" : "s"} analyzed{hiddenFromOverviewIds.size > 0 ? ` · ${hiddenFromOverviewIds.size} hidden from Overview` : ""}</p></div>
                  <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Check className="size-3.5 text-status-ok" />Evidence-linked scoring</span>
                </div>
                {isAnalyzing ? <CandidateSkeletons /> : (
                  <CandidateTable
                    candidates={candidates}
                    onSelectCandidate={(candidate) => { setSelectedCandidateId(candidate.id); setSelectedSkillId(null); }}
                    selectedCandidateId={selectedCandidateId}
                    blindMode={blindMode}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleSelectAll={handleToggleSelectAll}
                    onRemove={(id) => promptRemove([id])}
                    compareIds={compareIds}
                    onToggleCompare={handleToggleCompare}
                    reviewStatuses={reviewStatuses}
                    allowRemoval={false}
                  />
                )}
              </section>
              <p className="text-center text-xs text-muted-foreground">AI scores support human review and are not an automated hiring decision.</p>
            </section>
          )}

          {view === "compare" && (
            <CompareView
              candidates={comparedCandidates}
              blindMode={blindMode}
              reviewStatuses={reviewStatuses}
              onBack={() => setView("candidates")}
              onRemoveFromCompare={handleToggleCompare}
              onSelectCandidate={(candidate) => { setSelectedCandidateId(candidate.id); setSelectedSkillId(null); }}
            />
          )}

          {view === "overview" && candidates.length > 0 && (
            <div className="mt-5 flex justify-center">
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setView("candidates")}>Open candidate list <ChevronRight className="ml-1 size-4" /></Button>
            </div>
          )}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => navTo(id)}
              aria-current={view === id ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium ${view === id ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="size-[18px]" />{label}
            </button>
          ))}
        </nav>
      </div>

      {selectedCandidate && (
        <EvidenceViewer
          candidate={selectedCandidate}
          blindMode={blindMode}
          onClose={() => setSelectedCandidateId(undefined)}
          selectedSkillId={selectedSkillId}
          setSelectedSkillId={setSelectedSkillId}
          onRemove={(id) => promptRemove([id])}
          reviewStatus={reviewStatuses[selectedCandidate.id]}
          onSetReviewStatus={(status) => setReviewStatuses((current) => ({ ...current, [selectedCandidate.id]: status }))}
          note={reviewNotes[selectedCandidate.id] || ""}
          onNoteChange={(note) => setReviewNotes((current) => ({ ...current, [selectedCandidate.id]: note }))}
        />
      )}
    </div>
  );
}
