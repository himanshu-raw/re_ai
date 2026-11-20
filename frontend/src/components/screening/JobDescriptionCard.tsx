"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BriefcaseBusiness, Plus, X } from "lucide-react";

interface JobDescriptionCardProps {
  onAnalyze: (jd: string, requiredSkills: string[], preferredSkills: string[]) => void;
  isAnalyzing: boolean;
  hasFiles: boolean;
  initialJobDescription?: string;
  initialRequiredSkills?: string[];
  initialPreferredSkills?: string[];
}

function appendUniqueSkills(current: string[], incoming: string[]) {
  const seen = new Set(current.map((skill) => skill.toLowerCase()));
  return [
    ...current,
    ...incoming.filter((skill) => {
      const normalized = skill.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }),
  ];
}

export function JobDescriptionCard({
  onAnalyze,
  isAnalyzing,
  hasFiles,
  initialJobDescription = "",
  initialRequiredSkills = [],
  initialPreferredSkills = [],
}: JobDescriptionCardProps) {
  const [jd, setJd] = useState(initialJobDescription);
  const [mustHaves, setMustHaves] = useState(initialRequiredSkills);
  const [niceToHaves, setNiceToHaves] = useState(initialPreferredSkills);
  const [newSkill, setNewSkill] = useState("");
  const [skillType, setSkillType] = useState<"must" | "nice">("must");

  const addSkill = () => {
    const skills = newSkill.split(",").map((skill) => skill.trim()).filter(Boolean);
    if (skills.length === 0) return;
    if (skillType === "must") {
      setMustHaves((current) => appendUniqueSkills(current, skills));
    } else {
      setNiceToHaves((current) => appendUniqueSkills(current, skills));
    }
    setNewSkill("");
  };

  const removeSkill = (skill: string, type: "must" | "nice") => {
    if (type === "must") {
      setMustHaves((current) => current.filter((item) => item !== skill));
    } else {
      setNiceToHaves((current) => current.filter((item) => item !== skill));
    }
  };

  return (
    <Card className="flex flex-col h-full border-border/80 shadow-sm">
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><BriefcaseBusiness className="size-4" /></span>
            Job description
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Paste the role details and confirm the skills to evaluate.</p>
        </div>
        <Textarea
          id="job-description"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job description here..."
          className="resize-y flex-1 min-h-[150px] mb-5 rounded-xl border-border/80 bg-background text-sm leading-6"
          aria-label="Job description"
        />
        {!jd.trim() && (mustHaves.length > 0 || niceToHaves.length > 0) && (
          <p className="-mt-3 mb-5 text-xs text-muted-foreground">
            With no job description, analysis will use these skills as the role summary.
          </p>
        )}

        <div className="space-y-3 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground mb-2">Must-have skills</p>
            <div className="flex flex-wrap gap-2" aria-label="Must-have skills">
              {mustHaves.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-primary/25 text-primary bg-primary/5">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill, "must")} className="rounded-full opacity-70 hover:opacity-100" aria-label={`Remove ${skill}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {mustHaves.length === 0 && <span className="text-xs text-muted-foreground">No must-have skills added</span>}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Nice-to-have skills</p>
            <div className="flex flex-wrap gap-2" aria-label="Nice-to-have skills">
              {niceToHaves.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill, "nice")} className="rounded-full opacity-70 hover:opacity-100" aria-label={`Remove ${skill}`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {niceToHaves.length === 0 && <span className="text-xs text-muted-foreground">No nice-to-have skills added</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              value={newSkill}
              onChange={(event) => setNewSkill(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add skills, separated by commas"
              aria-label="Add skills, separated by commas"
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            <select
              value={skillType}
              onChange={(event) => setSkillType(event.target.value as "must" | "nice")}
              aria-label="Skill requirement type"
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="must">Must-have</option>
              <option value="nice">Nice-to-have</option>
            </select>
            <Button type="button" variant="outline" onClick={addSkill} className="h-10 rounded-lg">
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>

        <Button 
          onClick={() => onAnalyze(jd, mustHaves, niceToHaves)}
          disabled={!hasFiles || isAnalyzing || (!jd.trim() && mustHaves.length === 0 && niceToHaves.length === 0)}
          className="w-fit rounded-lg px-5 shadow-sm"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze candidates"}
        </Button>
      </div>
    </Card>
  );
}
