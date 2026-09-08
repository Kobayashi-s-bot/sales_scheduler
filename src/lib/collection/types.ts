export type SourceType = "rss" | "html";

export type PublicDocument = {
  url: string;
  title: string;
  content: string;
  publishedAt: string | null;
};

export type SourceConfig = {
  url: string;
  type: SourceType;
  refreshIntervalMinutes: number;
};

export interface SourceAdapter {
  readonly type: SourceType;
  fetch(config: SourceConfig, signal?: AbortSignal): Promise<PublicDocument[]>;
}

export type ExtractedEvent = {
  eventType: string;
  title: string;
  summary: string;
  eventDate: string | null;
  confidence: number;
};

export interface EventAnalyzer {
  analyze(input: PublicDocument): Promise<ExtractedEvent[]>;
}
