import type { ChatTraceEvent } from "./botTraceTypes";

const SHARED_TRACE_EVENTS_KEY = "boojum.sharedTrace.events";
const SESSION_TRACE_EVENTS_KEY = "boojum.sessionTrace.events";
const SESSION_TRACE_LIMIT = 300;

function readTraceEventsRaw(): ChatTraceEvent[] {
  try {
    const raw =
      window.localStorage.getItem(SHARED_TRACE_EVENTS_KEY) ??
      window.sessionStorage.getItem(SESSION_TRACE_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatTraceEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTraceEventsRaw(events: ChatTraceEvent[]) {
  window.localStorage.setItem(SHARED_TRACE_EVENTS_KEY, JSON.stringify(events));
  window.sessionStorage.setItem(SESSION_TRACE_EVENTS_KEY, JSON.stringify(events));
}

export function listSessionTraceEvents(): ChatTraceEvent[] {
  return readTraceEventsRaw();
}

export function getSessionTraceEvent(traceId: string): ChatTraceEvent | null {
  return readTraceEventsRaw().find((t) => t.traceId === traceId) ?? null;
}

export function appendSessionTraceEvent(event: ChatTraceEvent): ChatTraceEvent {
  const prev = readTraceEventsRaw();
  const without = prev.filter((t) => t.traceId !== event.traceId);
  const merged = [...without, event].slice(-SESSION_TRACE_LIMIT);
  writeTraceEventsRaw(merged);
  return event;
}

export function resetSessionTraceEvents() {
  window.localStorage.removeItem(SHARED_TRACE_EVENTS_KEY);
  window.sessionStorage.removeItem(SESSION_TRACE_EVENTS_KEY);
  writeTraceEventsRaw([]);
}
