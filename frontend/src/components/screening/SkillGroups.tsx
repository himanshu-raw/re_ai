"use client";

import { Skill } from "@/types/screening";

interface SkillGroupsProps {
  skills: Skill[];
  selectedSkillId: number | null;
  onSkillClick: (skillId: number) => void;
}

export function SkillGroups({ skills, selectedSkillId, onSkillClick }: SkillGroupsProps) {
  const matched = skills.filter(s => s.status === "matched");
  const related = skills.filter(s => s.status === "related");
  const missing = skills.filter(s => s.status === "missing");

  const renderGroup = (title: string, groupSkills: Skill[]) => {
    if (groupSkills.length === 0) return null;
    return (
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-muted-foreground mb-3">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {groupSkills.map(skill => {
            const isSelected = skill.id === selectedSkillId;
            let bgColorClass = "bg-muted text-foreground border-border";
            if (skill.status === "matched") bgColorClass = isSelected ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20";
            if (skill.status === "related") bgColorClass = isSelected ? "bg-status-warn text-primary-foreground border-status-warn" : "bg-status-warn-soft text-status-warn border-status-warn/20 hover:bg-status-warn-soft/80";
            if (skill.status === "missing") bgColorClass = isSelected ? "bg-status-bad text-primary-foreground border-status-bad" : "bg-status-bad-soft text-status-bad border-status-bad/20 hover:bg-status-bad-soft/80";

            return (
              <button
                key={skill.id}
                onClick={() => onSkillClick(skill.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${bgColorClass}`}
                aria-pressed={isSelected}
              >
                {skill.name}
                {skill.level && skill.status !== "missing" && (
                  <div className="flex gap-[2px] ml-1">
                    {[1, 2, 3].map(dot => (
                      <div 
                        key={dot} 
                        className={`w-1.5 h-1.5 rounded-full ${dot <= skill.level! ? "bg-current opacity-80" : "bg-current opacity-20"}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderGroup("Matched", matched)}
      {renderGroup("Related or partly supported", related)}
      {renderGroup("Missing", missing)}
    </div>
  );
}
