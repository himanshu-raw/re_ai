"""
Tier 1: Parsing and Structuring (Section IV-A of the paper).

Turns a resume section's raw text into dated, typed `entries` -- the atomic
unit that Tier 2 (skill_extractor) links skills to and Tier 3
(scoring_engine) scores. This module owns the three pre-score defenses the
paper calls out before any scoring happens:
  1. Hidden/invisible text is stripped.
  2. Dates are sanity-checked (no end before start, no end after T0).
  3. Only entry TYPE and DATES are ever used downstream -- never page
     position -- which is what makes the final score order-invariant (D4)
     and closes the positional channel exploited in adversarial resumes
     [Mu et al., arXiv:2512.20164].
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional, Tuple

from pydantic import BaseModel, Field

from app.services.llm_wrapper import llm_wrapper
from app.services.scoring_engine import EntryType, Tier


# --------------------------------------------------------------------------
# Section -> entry-type heuristic (Tier 1 also uses the section header,
# produced upstream by ResumeParser.segment_sections, as a strong prior;
# the LLM extraction below can still override it per-entry, e.g. a
# "Certifications" section containing a one-line mention with no real
# detail, or an "Experience" section containing a line that is really just
# a bare skills list).
# --------------------------------------------------------------------------

SECTION_TYPE_HINTS = {
    "certifications": EntryType.CERT,
    "projects": EntryType.PROJECT,
    "experience": EntryType.WORK,
    "work history": EntryType.WORK,
    "employment": EntryType.WORK,
    "internships": EntryType.WORK,
    "education": EntryType.EDU,
    "skills": EntryType.LIST,
    "technical skills": EntryType.LIST,
}


def guess_entry_type(section_name: str) -> EntryType:
    key = section_name.strip().lower()
    return SECTION_TYPE_HINTS.get(key, EntryType.WORK)


# --------------------------------------------------------------------------
# Pre-score defense 1: strip hidden/invisible text that an adversarial
# resume might use to stuff keywords (white-on-white text, zero-size runs,
# etc.). PyMuPDF's "text" extraction mode already drops most rendering-only
# artifacts; this is a lightweight second pass over control characters and
# zero-width/invisible unicode that can survive extraction.
# --------------------------------------------------------------------------

_INVISIBLE_CHARS_RE = re.compile(
    "[​‌‍⁠﻿­]"  # zero-width space/joiners, BOM, soft hyphen
    "|[\x00-\x08\x0b\x0c\x0e-\x1f]"            # stray control characters
)


def strip_invisible_text(text: str) -> str:
    return _INVISIBLE_CHARS_RE.sub("", text)


# --------------------------------------------------------------------------
# Depth cues + extraction schema (LLM-filled, Gemini structured output)
# --------------------------------------------------------------------------

class DepthCues(BaseModel):
    tool_named: bool = Field(description="The specific tool/stack/skill is mentioned by its own name.")
    action_verb_object: bool = Field(description="The skill appears as the direct object of an action verb (e.g. 'built X with Docker').")
    duration_or_credential: bool = Field(
        description=(
            "For work/project/education entries: the practice took at least three months. "
            "For certifications: the issuing body and credential/ID are given."
        )
    )


class ExtractedEntry(BaseModel):
    etype: str = Field(description="One of: cert, project, work, edu, list.")
    text: str = Field(description="The verbatim text of this entry/bullet.")
    start_date: Optional[str] = Field(default=None, description="ISO yyyy-mm-dd, or null if not stated/not applicable.")
    end_date: Optional[str] = Field(default=None, description="ISO yyyy-mm-dd, or the literal string 'present' for an ongoing role.")
    is_quantified: bool = Field(description="True if the entry states a concrete, measurable outcome (a number, %, scale).")
    depth_cues: DepthCues
    skills_mentioned: List[str] = Field(description="Skill names mentioned verbatim in this entry, normalized (e.g. 'React.js' -> 'React').")


class SectionEntries(BaseModel):
    entries: List[ExtractedEntry]


_PROMPT = """
You are an expert resume parser. Convert the following resume section into a
list of discrete, dated, typed entries. Treat each bullet, role, project, or
certification line as its own entry; a simple comma-separated skills list
("Frontend: React, TypeScript") is a SINGLE entry of type "list" containing
all of those skill names.

For every entry, extract:
- etype: cert | project | work | edu | list
- text: the verbatim source text of the entry
- start_date / end_date: ISO dates if given (end_date may be the literal
  string "present" for an ongoing role); null if the entry has no dates at
  all (e.g. a bare skills list)
- is_quantified: true only if there is a concrete measurable outcome (a
  number, percentage, scale, or similar), not vague claims
- depth_cues.tool_named: the specific skill/tool is named
- depth_cues.action_verb_object: the skill is the object of an action verb
  ("built X using Docker", not just "Docker" in a list)
- depth_cues.duration_or_credential: for work/project/education, the entry
  states at least ~3 months of practice; for a certification, the issuing
  body and a credential/ID are given
- skills_mentioned: every skill name verbatim in this entry, normalized to
  common form (e.g. "React.js" -> "React", "Postgres" -> "PostgreSQL")

Resume section ({section_name}):
{section_text}
"""


def extract_entries(section_name: str, section_text: str) -> List[ExtractedEntry]:
    clean_text = strip_invisible_text(section_text)
    prompt = _PROMPT.format(section_name=section_name, section_text=clean_text)
    result = llm_wrapper.generate_structured_output(prompt=prompt, schema=SectionEntries, temperature=0.0)
    if result is None:
        return []
    return result.entries


# --------------------------------------------------------------------------
# Pre-score defense 2: date sanity checks.
# --------------------------------------------------------------------------

def _parse_iso(d: Optional[str], today: date) -> Tuple[Optional[date], bool]:
    """Returns (parsed_date, is_open_ended)."""
    if d is None:
        return None, False
    if d.strip().lower() == "present":
        return today, True
    try:
        y, m, day = (int(p) for p in d.split("-"))
        return date(y, m, day), False
    except Exception:
        return None, False


@dataclass
class DateIssue:
    entry_text: str
    reason: str


@dataclass
class ValidatedEntry:
    etype: EntryType
    text: str
    start_date: Optional[date]
    end_date: Optional[date]
    is_open_ended: bool
    is_quantified: bool
    depth_cues: DepthCues
    skills_mentioned: List[str]
    issues: List[str] = field(default_factory=list)


def validate_and_normalize(entries: List[ExtractedEntry], today: Optional[date] = None) -> List[ValidatedEntry]:
    today = today or date.today()
    out: List[ValidatedEntry] = []

    for e in entries:
        issues: List[str] = []
        try:
            etype = EntryType(e.etype)
        except ValueError:
            etype = EntryType.WORK
            issues.append(f"unrecognized etype '{e.etype}', defaulted to work")

        start, _ = _parse_iso(e.start_date, today)
        end, open_ended = _parse_iso(e.end_date, today)

        # end cannot be before start
        if start and end and end < start:
            issues.append("end_date before start_date; dropping both")
            start, end = None, None

        # no end date after T0 (today)
        if end and end > today:
            issues.append("end_date after T0; clamped to today")
            end = today

        out.append(
            ValidatedEntry(
                etype=etype,
                text=e.text,
                start_date=start,
                end_date=end,
                is_open_ended=open_ended,
                is_quantified=e.is_quantified,
                depth_cues=e.depth_cues,
                skills_mentioned=e.skills_mentioned,
                issues=issues,
            )
        )
    return out


def entry_tier(entry: ValidatedEntry) -> Tier:
    """Table II: assign the evidence tier from entry type + quantification."""
    if entry.etype == EntryType.CERT:
        return Tier.T3
    if entry.etype in (EntryType.PROJECT, EntryType.WORK, EntryType.EDU):
        return Tier.T3 if entry.is_quantified else Tier.T2
    return Tier.T1  # list


def entry_delta(entry: ValidatedEntry) -> float:
    """delta(e): proportion of the 3 depth criteria met, in {0, 1/3, 2/3, 1}."""
    if entry.etype == EntryType.LIST:
        return 0.0
    cues = entry.depth_cues
    met = sum([cues.tool_named, cues.action_verb_object, cues.duration_or_credential])
    return met / 3.0
