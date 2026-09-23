"use client";

import { useState, useRef, useEffect } from 'react';
import { UploadCard, UploadFileState } from '@/components/screening/UploadCard';
import { JobDescriptionCard } from '@/components/screening/JobDescriptionCard';
import { CandidateTable } from '@/components/screening/CandidateTable';
import { EvidenceViewer } from '@/components/screening/EvidenceViewer';
import { BlindModeToggle } from '@/components/screening/BlindModeToggle';
import { ThemeToggle } from '@/components/screening/ThemeToggle';
import { Candidate } from '@/types/screening';
import { adaptBackendDataToMock } from '@/lib/mock-data';
import { useRemoveResumes } from '@/hooks/useRemoveResumes';
import { RemoveResumeDialog } from '@/components/screening/RemoveResumeDialog';
import { BulkActionsBar } from '@/components/screening/BulkActionsBar';

export default function Home() {
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [blindMode, setBlindMode] = useState(false);
  
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pendingRemovalIds, setPendingRemovalIds] = useState<string[]>([]);

  const evidenceRef = useRef<HTMLDivElement>(null);

  const { removeResumes, isRemoving } = useRemoveResumes({
    candidates,
    setCandidates,
    selectedIds,
    setSelectedIds,
    activeResumeId: selectedCandidateId || null,
    setActiveResumeId: (id) => setSelectedCandidateId(id || undefined),
    blindMode
  });

  const handleAnalyze = async (jd: string) => {
    if (files.length === 0) return;
    setIsAnalyzing(true);
    
    const formData = new FormData();
    files.forEach(f => formData.append("files", f.file));
    formData.append("jd", jd);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/upload-resumes`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      
      const adapted = adaptBackendDataToMock(data.results);
      setCandidates(prev => [...prev, ...adapted]);
      
      // Clear uploaded files on success
      setFiles([]);
    } catch (error) {
      console.error("Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidateId(candidate.id);
    setSelectedSkillId(null);
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleSelectAll = (checked: boolean, visibleIds: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach(id => next.add(id));
      } else {
        visibleIds.forEach(id => next.delete(id));
      }
      return next;
    });
  };

  const promptRemove = (ids: string[]) => {
    setPendingRemovalIds(ids);
    setIsDialogOpen(true);
  };

  const confirmRemove = async () => {
    await removeResumes(pendingRemovalIds);
    setIsDialogOpen(false);
    setPendingRemovalIds([]);
  };

  // Scroll evidence viewer into view
  useEffect(() => {
    if (selectedCandidateId && evidenceRef.current) {
      evidenceRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCandidateId]);

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
  
  // Dialog label helper
  const getDialogLabel = () => {
    if (pendingRemovalIds.length === 1) {
      const c = candidates.find(c => c.id === pendingRemovalIds[0]);
      return blindMode ? c?.blindLabel || "Candidate" : c?.fileName || "Resume";
    }
    return `${pendingRemovalIds.length} resumes`;
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Invisible aria-live region for announcements */}
      <div id="aria-live-region" className="sr-only" aria-live="polite" aria-atomic="true"></div>
      
      <RemoveResumeDialog 
        isOpen={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        onConfirm={confirmRemove} 
        label={getDialogLabel()} 
        isBulk={pendingRemovalIds.length > 1}
        isRemoving={isRemoving}
      />

      <main className="max-w-[1180px] mx-auto space-y-8 pb-16">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Resume Screening</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">Every score links back to the resume text that supports it.</p>
          </div>
          <div className="flex items-center space-x-6 bg-card px-4 py-2 rounded-full border border-border shadow-sm">
            <BlindModeToggle blindMode={blindMode} setBlindMode={setBlindMode} />
            <div className="w-px h-5 bg-border"></div>
            <ThemeToggle />
          </div>
        </header>

        {/* Job and candidates */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Job and candidates</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <UploadCard files={files} setFiles={setFiles} />
            <JobDescriptionCard onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} hasFiles={files.length > 0} />
          </div>
        </section>

        {/* Ranked candidates */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Ranked candidates</h2>
          
          <BulkActionsBar 
            selectedCount={selectedIds.size} 
            onClear={() => setSelectedIds(new Set())} 
            onRemove={() => promptRemove(Array.from(selectedIds))} 
          />

          <CandidateTable 
            candidates={candidates} 
            onSelectCandidate={handleSelectCandidate} 
            selectedCandidateId={selectedCandidateId}
            blindMode={blindMode}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onRemove={(id) => promptRemove([id])}
          />
        </section>

        {/* Evidence Viewer */}
        {selectedCandidate && (
          <section ref={evidenceRef}>
            <EvidenceViewer 
              candidate={selectedCandidate} 
              blindMode={blindMode} 
              onClose={() => setSelectedCandidateId(undefined)}
              selectedSkillId={selectedSkillId}
              setSelectedSkillId={setSelectedSkillId}
              onRemove={(id) => promptRemove([id])}
            />
          </section>
        )}

      </main>
      
      <footer className="text-center text-sm text-muted-foreground py-8 border-t border-border mt-8">
        Decision support only. A recruiter makes the final call.
      </footer>
    </div>
  );
}
