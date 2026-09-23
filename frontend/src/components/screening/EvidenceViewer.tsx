"use client";

import { useRef, useEffect } from "react";
import { Candidate } from "@/types/screening";
import { SkillGroups } from "./SkillGroups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";

interface EvidenceViewerProps {
  candidate: Candidate;
  blindMode: boolean;
  onClose: () => void;
  selectedSkillId: number | null;
  setSelectedSkillId: (id: number | null) => void;
  onRemove: (id: string) => void;
}

export function EvidenceViewer({ candidate, blindMode, onClose, selectedSkillId, setSelectedSkillId, onRemove }: EvidenceViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<{ [key: number]: HTMLElement | null }>({});

  // Auto-scroll to selected skill
  useEffect(() => {
    if (selectedSkillId && markRefs.current[selectedSkillId]) {
      const markElement = markRefs.current[selectedSkillId];
      if (markElement) {
        markElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [selectedSkillId]);

  const selectedSkillInfo = candidate.skills.find(s => s.id === selectedSkillId);

  return (
    <Card className="font-sans mt-8 border border-border shadow-none overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
        <h3 className="font-semibold text-lg">
          Evidence for {blindMode ? candidate.blindLabel : candidate.fileName}
        </h3>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onRemove(candidate.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Remove
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close evidence panel">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="border-l-4 border-primary bg-primary/5 px-6 py-4 text-sm text-foreground">
        <p>{candidate.summary}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Left: Document Text */}
        <div className="flex flex-col border-r border-border">
          <div className="px-5 py-3 border-b border-border bg-muted/5 text-xs text-muted-foreground">
            Highlighted text is evidence found in the resume. Click a highlight to see the skill.
          </div>
          <div 
            className="p-[20px] max-h-[560px] overflow-y-auto bg-muted/10 font-sans" 
            ref={scrollRef} 
            aria-label="Resume text region"
            style={{ scrollbarWidth: 'thin' }} // Use native thin scrollbar
          >
            {candidate.sections.map((section, sIdx) => (
              <div key={sIdx} style={{ marginBottom: '12px' }}>
                <h4 className="capitalize text-[13px] font-semibold text-muted-foreground mb-1">{section.title}</h4>
                <div className="text-[15px] leading-[1.75] text-foreground tracking-[0.005em] whitespace-pre-wrap">
                  {section.segments.map((seg, idx) => {
                    if (seg.isPii) {
                      if (blindMode) {
                        return <span key={idx} className="bg-foreground text-background px-1 rounded-sm select-none" aria-label="Redacted">&lt;{seg.piiType}&gt;</span>;
                      }
                      return <span key={idx}>{seg.text}</span>;
                    }

                    if (seg.skillId) {
                      const isSelected = seg.skillId === selectedSkillId;
                      const hasSelection = selectedSkillId !== null;
                      const skillObj = candidate.skills.find(s => s.id === seg.skillId);
                      const skillName = skillObj?.name || "Skill";
                      
                      return (
                        <mark
                          key={idx}
                          ref={el => { markRefs.current[seg.skillId!] = el; }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Evidence for ${skillName}`}
                          title={skillName}
                          onClick={() => setSelectedSkillId(seg.skillId!)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedSkillId(seg.skillId!); }}
                          className={`
                            cursor-pointer transition-all duration-200 outline-none
                            focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                            hover:brightness-110
                          `}
                          style={{
                            background: isSelected ? 'var(--hl-active-bg)' : 'var(--hl-bg)',
                            color: 'var(--hl-ink)',
                            borderBottom: isSelected ? '2px solid var(--hl-border)' : '2px dotted var(--hl-border)',
                            borderRadius: '3px',
                            padding: '1px 4px',
                            boxDecorationBreak: 'clone',
                            WebkitBoxDecorationBreak: 'clone',
                            marginInline: '2px',
                            opacity: hasSelection && !isSelected ? 0.75 : 1,
                            boxShadow: isSelected ? '0 0 0 1px var(--hl-border)' : 'none'
                          }}
                        >
                          {seg.text}
                        </mark>
                      );
                    }
                    return <span key={idx}>{seg.text}</span>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Skills & Details */}
        <div className="p-[20px] max-h-[560px] overflow-y-auto bg-muted/5 flex flex-col">
          <SkillGroups 
            skills={candidate.skills} 
            selectedSkillId={selectedSkillId} 
            onSkillClick={setSelectedSkillId} 
          />

          {/* Detail Box */}
          {selectedSkillInfo && (
            <div className="mt-auto pt-6 border-t border-border animate-in fade-in">
              <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                {selectedSkillInfo.name}
                {selectedSkillInfo.status === "missing" && (
                  <span className="text-[10px] uppercase tracking-wider bg-status-bad-soft text-status-bad px-2 py-0.5 rounded-full font-bold">
                    Ungrounded
                  </span>
                )}
              </h5>
              
              {selectedSkillInfo.status === "missing" ? (
                <p className="text-sm text-status-bad">No supporting text found in the parsed resume.</p>
              ) : (
                <>
                  <div className="text-[15px] text-foreground bg-background border border-border p-3 rounded-md shadow-sm mb-3">
                    <span className="text-muted-foreground select-none mr-2">"</span>
                    {candidate.sections.flatMap(s => s.segments).find(seg => seg.skillId === selectedSkillInfo.id)?.text?.trim()}
                    <span className="text-muted-foreground select-none ml-2">"</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedSkillInfo.note}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
