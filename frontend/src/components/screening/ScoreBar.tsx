"use client";

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
      <div 
        className="h-full bg-primary"
        style={{ width: `${score}%` }}
      />
    </div>
  );
}
