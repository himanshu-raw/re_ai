"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface JobDescriptionCardProps {
  onAnalyze: (jd: string) => void;
  isAnalyzing: boolean;
  hasFiles: boolean;
}

export function JobDescriptionCard({ onAnalyze, isAnalyzing, hasFiles }: JobDescriptionCardProps) {
  const [jd, setJd] = useState("Backend Engineer. You will build APIs and data pipelines. Must have Python and SQL. Experience with Docker and REST APIs. Nice to have: AWS, machine learning.");
  
  // Hardcoded extracted requirements matching the screenshot
  const mustHaves = ["Python", "SQL", "Docker", "REST APIs"];
  const niceToHaves = ["AWS", "Machine learning"];

  return (
    <Card className="flex flex-col h-full border border-border shadow-none">
      <div className="p-6 flex flex-col flex-1">
        <Textarea 
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste job description here..."
          className="resize-none flex-1 min-h-[120px] mb-4 text-sm"
          aria-label="Job description"
        />
        
        <div className="flex flex-wrap gap-2 mb-6" aria-label="Extracted requirements">
          {mustHaves.map(req => (
            <span key={req} className="px-3 py-1 rounded-full text-xs font-medium border border-primary text-primary bg-primary/5">
              {req}
            </span>
          ))}
          {niceToHaves.map(req => (
            <span key={req} className="px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted">
              {req}
            </span>
          ))}
        </div>

        <Button 
          onClick={() => onAnalyze(jd)} 
          disabled={!hasFiles || isAnalyzing}
          className="w-fit"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze candidates"}
        </Button>
      </div>
    </Card>
  );
}
