import { useState, useCallback } from "react";
import { Candidate } from "@/types/screening";
import { toast } from "sonner";

interface UseRemoveResumesProps {
  candidates: Candidate[];
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeResumeId: string | null;
  setActiveResumeId: (id: string | null) => void;
  blindMode: boolean;
}

export function useRemoveResumes({
  candidates,
  setCandidates,
  selectedIds,
  setSelectedIds,
  activeResumeId,
  setActiveResumeId,
  blindMode
}: UseRemoveResumesProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const getLabel = useCallback((ids: string[]) => {
    if (ids.length === 1) {
      const c = candidates.find(c => c.id === ids[0]);
      return blindMode ? c?.blindLabel || "Candidate" : c?.fileName || "Resume";
    }
    return `${ids.length} resumes`;
  }, [candidates, blindMode]);

  const removeResumes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    
    setIsRemoving(true);
    const label = getLabel(ids);
    
    try {
      let res;
      if (ids.length === 1) {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/resumes/${encodeURIComponent(ids[0])}`, {
          method: 'DELETE'
        });
      } else {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/resumes/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
      }

      if (!res.ok && res.status !== 404 && res.status !== 204 && res.status !== 200) {
        throw new Error("Failed to delete");
      }
      
      // Close active viewer if it's being deleted
      if (activeResumeId && ids.includes(activeResumeId)) {
        setActiveResumeId(null);
      }
      
      // Remove from selection
      setSelectedIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });

      // Remove from local state
      setCandidates(prev => prev.filter(c => !ids.includes(c.id)));
      
      toast.success(`${label} removed.`);
      
      // Announce for screen readers
      const ariaLive = document.getElementById("aria-live-region");
      if (ariaLive) ariaLive.textContent = `${label} removed.`;

    } catch (err) {
      console.error(err);
      toast.error(`Couldn't remove ${label}. Try again.`);
    } finally {
      setIsRemoving(false);
    }

  }, [candidates, activeResumeId, setCandidates, setActiveResumeId, setSelectedIds, getLabel]);

  return { removeResumes, isRemoving };
}
