import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { adminAPI } from "../../services/api";
import type { BotTraceEntry } from "../../utils/botTraceTypes";
import { normalizeTracePayload } from "../../utils/botTraceTypes";
import {
  appendSessionTraceEvent,
  getSessionTraceEvent,
  listSessionTraceEvents,
} from "../../utils/botTraceStore";
import "./BotTracePage.css";

const GRAPH_NODES = [
  "event_gate",
  "player_join",
  "round_end",
  "bot_flood_guard",
  "spam_filter",
  "targeting",
  "policy",
  "decide",
  "plan_memory_retrieval",
  "gather_context",
  "generate",
  "decide_memory_write",
  "persist_memory",
  "sanitize",
  "humanize",
  "end",
];

const GRAPH_EDGES: Array<{ from: string; to: string }> = [
  { from: "event_gate", to: "bot_flood_guard" },
  { from: "bot_flood_guard", to: "round_end" },
  { from: "bot_flood_guard", to: "player_join" },
  { from: "bot_flood_guard", to: "spam_filter" },
  { from: "bot_flood_guard", to: "end" },
  { from: "round_end", to: "sanitize" },
  { from: "player_join", to: "sanitize" },
  { from: "spam_filter", to: "targeting" },
  { from: "spam_filter", to: "sanitize" },
  { from: "spam_filter", to: "end" },
  { from: "targeting", to: "policy" },
  { from: "targeting", to: "end" },
  { from: "policy", to: "decide" },
  { from: "policy", to: "end" },
  { from: "decide", to: "plan_memory_retrieval" },
  { from: "decide", to: "end" },
  { from: "decide", to: "sanitize" },
  { from: "plan_memory_retrieval", to: "gather_context" },
  { from: "gather_context", to: "generate" },
  { from: "generate", to: "decide_memory_write" },
  { from: "decide_memory_write", to: "persist_memory" },
  { from: "decide_memory_write", to: "sanitize" },
  { from: "persist_memory", to: "sanitize" },
  { from: "sanitize", to: "humanize" },
  { from: "humanize", to: "end" },
];

const DIAGRAM_WIDTH = 560;
const DIAGRAM_HEIGHT = 1060;
const NODE_WIDTH = 120;
const NODE_HEIGHT = 36;

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
  event_gate: { x: 170, y: 20 },
  round_end: { x: 20, y: 120 },
  player_join: { x: 170, y: 120 },
  bot_flood_guard: { x: 320, y: 70 },
  spam_filter: { x: 320, y: 120 },
  targeting: { x: 320, y: 220 },
  policy: { x: 320, y: 320 },
  decide: { x: 320, y: 420 },
  plan_memory_retrieval: { x: 400, y: 500 },
  gather_context: { x: 320, y: 570 },
  generate: { x: 320, y: 640 },
  decide_memory_write: { x: 320, y: 710 },
  persist_memory: { x: 400, y: 790 },
  sanitize: { x: 320, y: 870 },
  humanize: { x: 320, y: 950 },
  end: { x: 320, y: 1020 },
};

export default function BotTracePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedId = searchParams.get("message") || searchParams.get("traceId") || "";
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDiagramOpen, setIsDiagramOpen] = useState(false);

  useEffect(() => {
    if (!selectedId || !user?.is_superuser) return;
    const cached = getSessionTraceEvent(selectedId);
    if (cached && Array.isArray(cached.trace) && cached.trace.length > 0) {
      setLoadError(null);
      return;
    }
    let cancelled = false;
    let attempt = 0;
    setLoadError(null);

    const tryLoad = () => {
      adminAPI
        .getBotTrace(selectedId)
        .then((data) => {
          if (cancelled) return;
          appendSessionTraceEvent(normalizeTracePayload(data));
          setVersion((v) => v + 1);
          setLoadError(null);
        })
        .catch(() => {
          if (cancelled) return;
          attempt += 1;
          if (attempt < 8) {
            window.setTimeout(tryLoad, 400);
            return;
          }
          setLoadError("Trace not found or expired.");
        });
    };

    tryLoad();
    return () => {
      cancelled = true;
    };
  }, [selectedId, user?.is_superuser]);

  const traces = useMemo(() => listSessionTraceEvents(), [version]);

  if (!user?.is_superuser) {
    return (
      <main className="bot-trace-page">
        <p>You must be a superuser to view bot traces.</p>
      </main>
    );
  }
  const selectedTrace = selectedId
    ? traces.find((t) => t.traceId === selectedId) ?? null
    : traces.find((t) => Array.isArray(t.trace) && t.trace.length > 0) ?? traces[0] ?? null;
  const nodeEntries = (selectedTrace?.trace || []).filter(
    (item): item is BotTraceEntry & { node: string } =>
      item.kind === "node" && typeof item.node === "string"
  );
  const activated = new Set(nodeEntries.map((n) => n.node));
  const activeNode = selectedNode || nodeEntries[0]?.node || null;
  const activeNodeDetails = nodeEntries.filter((n) => n.node === activeNode);
  const edgeEntries = (selectedTrace?.trace || []).filter((item) => item.kind === "edge");
  const activatedEdges = new Set(
    edgeEntries
      .filter((e) => e.from && e.to)
      .map((e) => {
        const to = String(e.to) === "__end__" ? "end" : String(e.to);
        return `${String(e.from)}->${to}`;
      })
  );
  const activeEndShortcutEdges = edgeEntries
    .filter((e) => e.from && String(e.to) === "__end__")
    .map((e) => String(e.from))
    .filter((fromNode) => !["spam_filter", "targeting", "policy", "decide"].includes(fromNode));

  function openTrace(traceId: string) {
    setSearchParams({ message: traceId });
    setSelectedNode(null);
  }

  function renderDiagram(mode: "inline" | "popup") {
    return (
      <div
        className={`trace-diagram-wrap trace-diagram-wrap-vertical ${
          mode === "popup" ? "trace-diagram-wrap-popup" : ""
        }`}
      >
        <svg
          className="trace-diagram-lines"
          width={DIAGRAM_WIDTH}
          height={DIAGRAM_HEIGHT}
          viewBox={`0 0 ${DIAGRAM_WIDTH} ${DIAGRAM_HEIGHT}`}
          preserveAspectRatio="xMinYMin meet"
        >
          <defs>
            <marker
              id={`trace-arrow-${mode}`}
              markerWidth="10"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L10,4 L0,8 z" fill="#667085" />
            </marker>
            <marker
              id={`trace-arrow-active-${mode}`}
              markerWidth="10"
              markerHeight="8"
              refX="8"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L10,4 L0,8 z" fill="#7ce7c6" />
            </marker>
          </defs>
          {GRAPH_EDGES.map((edge) => {
            const from = NODE_POSITIONS[edge.from];
            const to = NODE_POSITIONS[edge.to];
            if (!from || !to) return null;
            const isActive = activatedEdges.has(`${edge.from}->${edge.to}`);
            const fromCx = from.x + NODE_WIDTH / 2;
            const fromCy = from.y + NODE_HEIGHT;
            const toCx = to.x + NODE_WIDTH / 2;
            const toCy = to.y;
            // Route long downward branches close to destination to avoid
            // visually implying they connect to intermediate nodes.
            const isLongDownward = toCy - fromCy > 180;
            const midY = isLongDownward
              ? toCy - 30
              : fromCy + Math.max(20, (toCy - fromCy) / 2);
            // Dedicated right-side lanes for end shortcuts.
            const endLaneX = DIAGRAM_WIDTH - 10;
            const isPersistToNode =
              edge.from === "decide_memory_write" && edge.to === "persist_memory";
            const isPersistBackToMain =
              edge.from === "persist_memory" && edge.to === "sanitize";
            const isPlanToNode =
              edge.from === "decide" && edge.to === "plan_memory_retrieval";
            const isPlanBackToMain =
              edge.from === "plan_memory_retrieval" && edge.to === "gather_context";
            const isSharedEndBranch =
              edge.to === "end" &&
              ["spam_filter", "bot_flood_guard", "targeting", "policy", "decide"].includes(
                edge.from
              );
            const endApproachY = toCy + 22;
            const pathD = isPlanToNode
              ? `M ${fromCx} ${fromCy} L ${toCx} ${fromCy} L ${toCx} ${toCy}`
              : isPlanBackToMain
              ? `M ${fromCx} ${fromCy} L ${toCx} ${fromCy} L ${toCx} ${toCy}`
              : isPersistToNode
              ? `M ${fromCx} ${fromCy} L ${toCx} ${fromCy} L ${toCx} ${toCy}`
              : isPersistBackToMain
              ? `M ${fromCx} ${fromCy} L ${toCx} ${fromCy} L ${toCx} ${toCy}`
              : isSharedEndBranch
              ? `M ${fromCx} ${fromCy} L ${endLaneX} ${fromCy} L ${endLaneX} ${endApproachY} L ${toCx} ${endApproachY} L ${toCx} ${toCy}`
              : `M ${fromCx} ${fromCy} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${toCy}`;
            return (
              <path
                key={`${mode}-${edge.from}-${edge.to}`}
                d={pathD}
                fill="none"
                stroke={isActive ? "#7ce7c6" : "#667085"}
                strokeWidth={isActive ? 2.4 : 1.4}
                markerEnd={`url(#${isActive ? `trace-arrow-active-${mode}` : `trace-arrow-${mode}`})`}
              />
            );
          })}
          {activeEndShortcutEdges.map((fromNode) => {
            const from = NODE_POSITIONS[fromNode];
            const to = NODE_POSITIONS.end;
            if (!from || !to) return null;
            const fromCx = from.x + NODE_WIDTH / 2;
            const fromCy = from.y + NODE_HEIGHT;
            const toCx = to.x + NODE_WIDTH / 2;
            const toCy = to.y;
            const midY = fromCy + Math.max(24, (toCy - fromCy) / 2);
            const pathD = `M ${fromCx} ${fromCy} L ${fromCx} ${midY} L ${toCx} ${midY} L ${toCx} ${toCy}`;
            return (
              <path
                key={`${mode}-shortcut-${fromNode}-end`}
                d={pathD}
                fill="none"
                stroke="#7ce7c6"
                strokeWidth={2.2}
                strokeDasharray="4 4"
                markerEnd={`url(#trace-arrow-active-${mode})`}
              />
            );
          })}
        </svg>

        <div className="trace-flow trace-flow-vertical">
          {GRAPH_NODES.map((node) => (
            <button
              key={`${mode}-${node}`}
              type="button"
              className={`trace-flow-node ${
                activated.has(node) ? "trace-flow-node-active" : ""
              } ${activeNode === node ? "trace-flow-node-selected" : ""}`}
              onClick={() => setSelectedNode(node)}
              style={{
                left: `${NODE_POSITIONS[node]?.x ?? 0}px`,
                top: `${NODE_POSITIONS[node]?.y ?? 0}px`,
              }}
            >
              {node}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderStateDiff(beforeRaw: unknown, afterRaw: unknown) {
    const before =
      beforeRaw && typeof beforeRaw === "object"
        ? (beforeRaw as Record<string, unknown>)
        : {};
    const after =
      afterRaw && typeof afterRaw === "object"
        ? (afterRaw as Record<string, unknown>)
        : {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    const LABELS: Record<string, string> = {
      memory_persisted: "Memory persisted",
      memory_write_skip_reason: "Memory write skip reason",
    };

    function formatValue(key: string, value: unknown) {
      if (key === "memory_write_skip_reason") {
        if (value == null) return "none";
        return String(value).replace(/_/g, " ");
      }
      if (typeof value === "boolean") return value ? "true" : "false";
      return JSON.stringify(value) ?? "undefined";
    }

    if (keys.length === 0) {
      return <p className="muted">No state fields captured.</p>;
    }

    return (
      <div className="trace-state-list">
        {keys.map((key) => {
          const beforeValue = before[key];
          const afterValue = after[key];
          const beforeText = formatValue(key, beforeValue);
          const afterText = formatValue(key, afterValue);
          const changed = beforeText !== afterText;
          return (
            <div
              key={key}
              className={`trace-state-row ${changed ? "trace-state-row-changed" : ""}`}
            >
              <div className="trace-state-key">{LABELS[key] ?? key}</div>
              <div className="trace-state-before">{beforeText ?? "undefined"}</div>
              <div className="trace-state-after">{afterText ?? "undefined"}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <main className="bot-trace-page">
      <div className="play-toolbar">
        <div>
          <h1 className="page-heading">Bot trace dashboard</h1>
          <p className="muted">
            LangGraph traces for bot chat. Opened from a game room or loaded by trace id
            from the server (kept ~7 days).
          </p>
          {loadError ? <p className="bot-trace-error">{loadError}</p> : null}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setVersion((v) => v + 1)}
        >
          Refresh
        </button>
      </div>

      <section className="layout">
        <div className="card card-elevated">
          <h2>Session events ({traces.length})</h2>
          {traces.length === 0 ? (
            <p className="muted">
              No traces captured yet for this session.
            </p>
          ) : (
            <ul className="trace-message-list">
              {traces.map((t) => {
                const isActive = selectedTrace?.traceId === t.traceId;
                return (
                  <li key={t.traceId}>
                    <button
                      type="button"
                      className={`btn btn-ghost trace-open-btn ${
                        isActive ? "trace-open-btn-active" : ""
                      }`}
                      onClick={() => openTrace(t.traceId)}
                    >
                      {t.source.sender}: {t.source.text} ({t.source.eventType})
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card card-elevated">
          <h2>Trace details</h2>
          {!selectedTrace ? (
            <p className="muted">Select a message to inspect the graph trace.</p>
          ) : (
            <>
              <p>
                <strong>Source:</strong> {selectedTrace.source.sender} (
                {selectedTrace.source.eventType})
              </p>
              <p>
                <strong>Trigger text:</strong> {selectedTrace.source.text}
              </p>
              <p>
                <strong>Generated reply:</strong>{" "}
                {selectedTrace.generatedReply || "(no reply sent)"}
              </p>
              {!selectedTrace.trace || selectedTrace.trace.length === 0 || nodeEntries.length === 0 ? (
                <p className="muted">
                  {loadError
                    ? loadError
                    : "Graph trace is still loading or was not recorded for this turn."}
                </p>
              ) : (
                <>
                  <div className="trace-diagram-header">
                    <h3>Graph flow</h3>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setIsDiagramOpen(true)}
                    >
                      Expand diagram
                    </button>
                  </div>
                  <div className="trace-flow-layout">
                    {renderDiagram("inline")}

                    <div className="trace-right-panel">
                      <h3>Node details</h3>
                      {!activeNode ? (
                        <p className="muted">No activated node available.</p>
                      ) : activeNodeDetails.length === 0 ? (
                        <p className="muted">
                          {activeNode} was not activated in this event.
                        </p>
                      ) : (
                        <div className="trace-node-list">
                          {activeNodeDetails.map((item, idx) => (
                            <details
                              key={`${activeNode}-${idx}`}
                              className="trace-node-card"
                              open
                            >
                              <summary>
                                <strong>{item.node}</strong> (hit #{idx + 1})
                              </summary>
                              <p className="muted">
                                {item.context || "No node context was captured."}
                              </p>
                              <div className="trace-state-header">
                                <span>Field</span>
                                <span>State before</span>
                                <span>State after</span>
                              </div>
                              {renderStateDiff(item.before, item.after)}
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {isDiagramOpen ? (
                    <div className="trace-diagram-modal" onClick={() => setIsDiagramOpen(false)}>
                      <div
                        className="trace-diagram-modal-content"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="trace-diagram-header">
                          <h3>Expanded graph diagram</h3>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setIsDiagramOpen(false)}
                          >
                            Close
                          </button>
                        </div>
                        {renderDiagram("popup")}
                      </div>
                    </div>
                  ) : null}

                  <h3>Transitions</h3>
                  <div className="trace-node-list">
                    {edgeEntries.map((item, idx) => (
                      <details key={`edge-${idx}`} className="trace-node-card">
                        <summary>
                          <strong>Transition:</strong> {item.from} -&gt; {item.to}
                        </summary>
                        <p className="muted">
                          {item.reason || "No transition reason was captured."}
                        </p>
                      </details>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
