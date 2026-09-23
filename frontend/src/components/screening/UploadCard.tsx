"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface UploadFileState {
  file: File;
  status: "uploading" | "parsed" | "failed";
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
      status: "parsed" as const // For now mock status
    }));
    setFiles(prev => [...prev, ...fileArray]);
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
    <Card className="flex flex-col h-full border border-border shadow-none">
      <div className="p-6 flex flex-col flex-1">
        <div 
          className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer flex-1 min-h-[160px] ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if(e.key === 'Enter') fileInputRef.current?.click() }}
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
          <p className="font-semibold text-foreground">Drop resumes here</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, DOCX or TXT. Up to 50 at once.</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4 max-h-32 overflow-y-auto space-y-2">
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded text-sm group">
                <span className="truncate max-w-[200px]" title={f.file.name}>{f.file.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={f.status === "failed" ? "destructive" : "default"} className={f.status === "parsed" ? "bg-status-ok-soft text-status-ok hover:bg-status-ok-soft/80" : ""}>
                    {f.status}
                  </Badge>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${f.file.name}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
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
