"use client";

import { Badge } from "@/components/ui/badge";

export function ConfidenceBadge({ confidence }: { confidence: "High" | "Medium" | "Low" }) {
  if (confidence === "High") {
    return <Badge variant="outline" className="bg-status-ok-soft text-status-ok border-status-ok/20">High</Badge>;
  }
  if (confidence === "Medium") {
    return <Badge variant="outline" className="bg-status-warn-soft text-status-warn border-status-warn/20">Medium</Badge>;
  }
  return <Badge variant="outline" className="bg-status-bad-soft text-status-bad border-status-bad/20">Low</Badge>;
}
