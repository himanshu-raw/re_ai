import { Candidate, ResumeSection, Segment, Skill } from "@/types/screening";

type Span = {
  start: number;
  end: number;
  skillId?: number;
  piiType?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pythonOffsetToJsOffset(text: string, offset: number): number {
  let codePointOffset = 0;
  let jsOffset = 0;

  for (const character of text) {
    if (codePointOffset >= offset) break;
    codePointOffset += 1;
    jsOffset += character.length;
  }

  return jsOffset;
}

function createSegments(text: string, spans: Span[]): Segment[] {
  const validSpans = spans.filter(
    ({ start, end }) =>
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      end <= text.length &&
      start < end,
  );
  const boundaries = Array.from(
    new Set([0, text.length, ...validSpans.flatMap(({ start, end }) => [start, end])]),
  ).sort((a, b) => a - b);
  const segments: Segment[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (start === end) continue;

    const piiSpan = validSpans.find(
      (span) => span.piiType && span.start <= start && span.end >= end,
    );
    const skillSpan = validSpans.find(
      (span) => span.skillId && span.start <= start && span.end >= end,
    );
    const segment: Segment = {
      text: text.slice(start, end),
      ...(piiSpan
        ? { isPii: true, piiType: piiSpan.piiType }
        : skillSpan
          ? { skillId: skillSpan.skillId }
          : {}),
    };
    const previous = segments[segments.length - 1];

    if (
      previous &&
      previous.isPii === segment.isPii &&
      previous.piiType === segment.piiType &&
      previous.skillId === segment.skillId
    ) {
      previous.text += segment.text;
    } else {
      segments.push(segment);
    }
  }

  return segments;
}

function findEvidenceSpans(
  text: string,
  skillId: number,
  evidenceTexts: string[],
): Span[] {
  const spans: Span[] = [];

  for (const evidenceText of evidenceTexts) {
    if (!evidenceText) continue;
    let start = 0;

    while ((start = text.indexOf(evidenceText, start)) !== -1) {
      spans.push({ start, end: start + evidenceText.length, skillId });
      start += evidenceText.length;
    }
  }

  return spans;
}

function getEvidenceTexts(card: Record<string, unknown>): string[] {
  if (!Array.isArray(card.evidence)) return [];

  return card.evidence.flatMap((evidence) =>
    isRecord(evidence) && typeof evidence.text === "string" ? [evidence.text] : [],
  );
}

function getEvidenceNotes(card: Record<string, unknown>): string[] {
  if (!Array.isArray(card.evidence)) return [];

  return card.evidence.flatMap((evidence) => {
    if (!isRecord(evidence)) return [];
    const parts: string[] = [];
    if (typeof evidence.note === "string" && evidence.note) parts.push(evidence.note);
    if (typeof evidence.years_ago === "number") {
      parts.push(`${evidence.years_ago} years ago`);
    }
    return parts.length > 0 ? [parts.join(", ")] : [];
  });
}

function getPiiSpans(
  masksBySection: Record<string, unknown>,
  sectionName: string,
  text: string,
): Span[] {
  const masks = masksBySection[sectionName];
  if (!Array.isArray(masks)) return [];

  return masks.flatMap((mask) => {
    if (
      !isRecord(mask) ||
      typeof mask.start !== "number" ||
      typeof mask.end !== "number" ||
      typeof mask.type !== "string"
    ) {
      return [];
    }
    return [
      {
        start: pythonOffsetToJsOffset(text, mask.start),
        end: pythonOffsetToJsOffset(text, mask.end),
        piiType: mask.type,
      },
    ];
  });
}

function toResumeSections(
  rawSections: Record<string, unknown>,
  masksBySection: Record<string, unknown>,
  skillSpansBySection: Map<string, Span[]>,
): ResumeSection[] {
  return Object.entries(rawSections).flatMap(([title, value]) => {
    if (typeof value !== "string") return [];
    return [
      {
        title,
        segments: createSegments(value, [
          ...getPiiSpans(masksBySection, title, value),
          ...(skillSpansBySection.get(title) ?? []),
        ]),
      },
    ];
  });
}

function getBlindLabel(index: number): string {
  let value = index + 1;
  let label = "";

  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }

  return `Candidate ${label}`;
}

export function adaptBackendResultsToCandidates(
  results: unknown,
  startIndex = 0,
): Candidate[] {
  if (!Array.isArray(results)) {
    throw new Error("The resume API response did not include a results array.");
  }

  return results.map((result, index) => {
    if (
      !isRecord(result) ||
      (typeof result.candidate_id !== "string" &&
        typeof result.candidate_id !== "number") ||
      typeof result.filename !== "string"
    ) {
      throw new Error(`The resume API returned an invalid result at index ${index}.`);
    }

    const rawSections = isRecord(result.sections) ? result.sections : {};
    const masksBySection = isRecord(result.pii_masks) ? result.pii_masks : {};
    const rawCards = Array.isArray(result.skill_cards)
      ? result.skill_cards.filter(isRecord)
      : [];
    const skills: Skill[] = rawCards.flatMap((card, cardIndex) => {
      if (typeof card.skill !== "string" || !card.skill.trim()) return [];

      const cardStatus = typeof card.status === "string" ? card.status : "";
      const status =
        cardStatus === "Missing"
          ? "missing"
          : cardStatus === "Verified"
            ? "matched"
            : "related";
      const evidenceNotes = getEvidenceNotes(card);
      const numeric = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? value : undefined;

      return [
        {
          id: cardIndex + 1,
          name: card.skill,
          status,
          note: evidenceNotes.length > 0 ? evidenceNotes.join("; ") : cardStatus,
          weight: numeric(card.weight),
          evidenceScore: numeric(card.E),
          freshness: numeric(card.F),
          projectScore: numeric(card.P),
          combinedScore: numeric(card.C),
          contribution: numeric(card.contribution),
        },
      ];
    });

    const skillSpansBySection = new Map<string, Span[]>();
    rawCards.forEach((card, cardIndex) => {
      const skill = skills.find((item) => item.id === cardIndex + 1);
      if (!skill || skill.status === "missing") return;

      for (const [sectionName, sectionText] of Object.entries(rawSections)) {
        if (typeof sectionText !== "string") continue;
        const spans = findEvidenceSpans(
          sectionText,
          skill.id,
          getEvidenceTexts(card),
        );
        if (spans.length > 0) {
          skillSpansBySection.set(sectionName, [
            ...(skillSpansBySection.get(sectionName) ?? []),
            ...spans,
          ]);
        }
      }
    });

    const sections = toResumeSections(rawSections, masksBySection, skillSpansBySection);
    const score =
      typeof result.score === "number" && Number.isFinite(result.score)
        ? result.score
        : 0;
    const mustHaveMet =
      typeof result.must_have_met === "number" ? result.must_have_met : 0;
    const mustHaveTotal =
      typeof result.must_have_total === "number" ? result.must_have_total : 0;
    const narrative = isRecord(result.narrative) ? result.narrative : undefined;
    const summary =
      typeof narrative?.summary === "string" && narrative.summary.trim()
        ? narrative.summary.trim()
        : `Match score: ${score}. ${mustHaveMet} of ${mustHaveTotal} must-have skills have supporting evidence.`;
    const confidence =
      result.confidence === "High" ||
      result.confidence === "Medium" ||
      result.confidence === "Low"
        ? result.confidence
        : "Low";

    return {
      id: String(result.candidate_id),
      fileName: result.filename,
      blindLabel: getBlindLabel(startIndex + index),
      score,
      confidence,
      mustHaveMet,
      mustHaveTotal,
      needsReview:
        confidence === "Low" ||
        mustHaveMet < mustHaveTotal ||
        !narrative?.summary,
      summary,
      sections,
      skills,
    };
  });
}
