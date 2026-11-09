import { z } from "zod";
import type { EventAnalyzer, ExtractedEvent, PublicDocument } from "@/lib/collection/types";

const eventSchema = z.object({
  eventType: z.string().trim().min(1).max(100), title: z.string().trim().min(1).max(300), summary: z.string().trim().max(5000),
  eventDate: z.iso.date().nullable(), confidence: z.number().min(0).max(1),
}).strict();

export function validateAnalyzerResponse(value: unknown): ExtractedEvent[] { return z.array(eventSchema).max(20).parse(value); }

export class MockEventAnalyzer implements EventAnalyzer {
  constructor(private readonly result: unknown = []) {}
  async analyze(input: PublicDocument) { void input; return validateAnalyzerResponse(this.result); }
}

export class HeuristicEventAnalyzer implements EventAnalyzer {
  async analyze(input: PublicDocument) {
    const text = `${input.title} ${input.content}`;
    const eventType = /展示会|expo|exhibition/i.test(text) ? "exhibition" : /周年|anniversary/i.test(text) ? "anniversary" : /クリスマス|christmas/i.test(text) ? "christmas" : null;
    if (!eventType) return [];
    const rawDate = text.match(/(20\d{2})[年\/-](\d{1,2})[月\/-](\d{1,2})日?/)?.slice(1).map(Number);
    const eventDate = rawDate ? `${rawDate[0]}-${String(rawDate[1]).padStart(2, "0")}-${String(rawDate[2]).padStart(2, "0")}` : null;
    return validateAnalyzerResponse([{ eventType, title: input.title, summary: input.content.slice(0, 500), eventDate, confidence: eventDate ? 0.8 : 0.55 }]);
  }
}

export function toAnalyzerInput(document: PublicDocument): PublicDocument {
  return { url: document.url, title: document.title, content: document.content, publishedAt: document.publishedAt };
}
