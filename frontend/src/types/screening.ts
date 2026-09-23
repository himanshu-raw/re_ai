export interface Segment {
  text: string;
  skillId?: number;
  isPii?: boolean;
  piiType?: string;
}

export interface ResumeSection {
  title: string;
  segments: Segment[];
}

export interface Skill {
  id: number;
  name: string;
  status: "matched" | "related" | "missing";
  level?: 1 | 2 | 3; // 1: Beginner, 2: Intermediate, 3: Expert
  note?: string;
}

export interface Candidate {
  id: string;
  fileName: string;
  blindLabel: string; // e.g. "Candidate A"
  score: number; // 0-100
  confidence: "High" | "Medium" | "Low";
  mustHaveMet: number;
  mustHaveTotal: number;
  needsReview: boolean;
  summary: string; // Contains both strengths and gaps in 2 sentences.
  sections: ResumeSection[];
  skills: Skill[];
}
