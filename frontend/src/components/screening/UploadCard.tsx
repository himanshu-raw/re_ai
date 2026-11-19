"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, X } from "lucide-react";

export interface UploadFileState {
  file: File;
  status: "ready" | "failed";
}

interface UploadCardProps {
  files: UploadFileState[];
  setFiles: React.Dispatch<React.SetStateAction<UploadFileState[]>>;
}

export function UploadCard({ files, setFiles }: UploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles).map(file => ({
      file,
      status: "ready" as const,
    }));
    setFiles(prev => [...prev, ...fileArray]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <Card className="flex flex-col h-full border-border/80 shadow-sm">
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
            Upload resumes
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Add candidate files to this screening.</p>
        </div>
        <div 
          className={`border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer flex-1 min-h-[160px] ${isDragging ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          tabIndex={0}
          role="button"
          aria-label="Upload resumes drag and drop area"
        >
          <input 
            type="file" 
            multiple 
            accept=".pdf,.docx,.txt"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            ref={fileInputRef}
          />
          <span className="mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Upload className="size-5" /></span>
          <p className="font-semibold text-foreground">Drop resumes here or browse</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, DOCX or TXT · Up to 50 files</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 max-h-36 overflow-y-auto space-y-2" aria-label="Files ready to analyze">
            {files.map((f, idx) => (
              <div key={`${f.file.name}-${idx}`} className="flex items-center justify-between gap-3 bg-muted/60 px-3 py-2.5 rounded-lg text-sm group">
                <span className="min-w-0 truncate" title={f.file.name}>{f.file.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={f.status === "failed" ? "border-status-bad/30 bg-status-bad-soft text-status-bad" : "border-status-ok/25 bg-status-ok-soft text-status-ok"}>
                    {f.status === "ready" ? "Ready" : "Failed"}
                  </Badge>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-status-bad-soft hover:text-status-bad opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    aria-label={`Remove ${f.file.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
