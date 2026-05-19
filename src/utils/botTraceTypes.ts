export interface BotTraceEntry {
  kind: "node" | "edge";
  node?: string;
  from?: string;
  to?: string;
  context?: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface ChatTraceEvent {
  traceId: string;
  source: {
    sender: string;
    text: string;
    eventType: string;
    isRoundActive?: boolean;
  };
  trace: BotTraceEntry[];
  generatedReply: string;
  timestamp: number;
  botId?: number;
  roomSlug?: string;
}

export function normalizeTracePayload(raw: Record<string, unknown>): ChatTraceEvent {
  const source = (raw.source as ChatTraceEvent["source"]) || {
    sender: "",
    text: "",
    eventType: "chat",
  };
  return {
    traceId: String(raw.traceId ?? raw.trace_id ?? ""),
    source,
    trace: Array.isArray(raw.trace) ? (raw.trace as BotTraceEntry[]) : [],
    generatedReply: String(raw.generatedReply ?? ""),
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now() / 1000,
    botId: typeof raw.botId === "number" ? raw.botId : undefined,
    roomSlug: typeof raw.roomSlug === "string" ? raw.roomSlug : undefined,
  };
}
