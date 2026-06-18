import { useEffect, useRef, useState } from "react";
import type { Flow } from "../../model/flow.js";
import { statusClass } from "../../model/flow.js";
import { flowDuration, flowHost, flowPath, flowScheme, flowSize, responseMime } from "../search.js";
import { formatBytes, formatDuration } from "../format.js";

const ROW_H = 26;
const OVERSCAN = 8;

interface Props {
  flows: Flow[];
  selectedId: string | undefined;
  onSelect: (flow: Flow) => void;
  showSource: boolean;
}

export function FlowList({ flows, selectedId, onSelect, showSource }: Props): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewport(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = flows.length * ROW_H;
  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const visibleCount = Math.ceil(viewport / ROW_H) + OVERSCAN * 2;
  const last = Math.min(flows.length, first + visibleCount);
  const offsetY = first * ROW_H;
  const slice = flows.slice(first, last);

  return (
    <div className="sift-list-pane">
      <div className="sift-list-head">
        <div>Method</div>
        <div>Status</div>
        <div>URL</div>
        <div>Type</div>
        <div className="num">Size</div>
        <div className="num">Time</div>
      </div>
      <div
        className="sift-rows"
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: total, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {slice.map((flow) => (
              <Row
                key={flow.id}
                flow={flow}
                selected={flow.id === selectedId}
                onSelect={onSelect}
                showSource={showSource}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  flow,
  selected,
  onSelect,
  showSource,
}: {
  flow: Flow;
  selected: boolean;
  onSelect: (flow: Flow) => void;
  showSource: boolean;
}): JSX.Element {
  const cls = statusClass(flow.response.status);
  const host = flowHost(flow);
  const scheme = flowScheme(flow);
  const path = flowPath(flow);
  const duration = flowDuration(flow);

  return (
    <div
      className={`sift-row${selected ? " selected" : ""}`}
      onClick={() => onSelect(flow)}
      role="row"
      aria-selected={selected}
    >
      <div className="cell sift-method">{flow.request.method}</div>
      <div className={`cell sift-status status-${cls}`}>
        {flow.response.status || "—"}
      </div>
      <div className="cell sift-url" title={flow.request.url}>
        <span className="host">{scheme ? `${scheme}://${host}` : host}</span>
        {path}
        {showSource ? <span className="src-tag">{flow.source}</span> : null}
      </div>
      <div className="cell sift-mime" title={responseMime(flow)}>
        {responseMime(flow) || "—"}
      </div>
      <div className="cell num">{formatBytes(flowSize(flow))}</div>
      <div className="cell num">{formatDuration(duration)}</div>
    </div>
  );
}
