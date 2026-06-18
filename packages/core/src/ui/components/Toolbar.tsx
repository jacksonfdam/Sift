import type { StatusClass } from "../../model/flow.js";
import type { Facets, FilterCriteria } from "../search.js";

const STATUS_CLASSES: StatusClass[] = ["2xx", "3xx", "4xx", "5xx"];

interface Props {
  criteria: FilterCriteria;
  facets: Facets;
  shown: number;
  total: number;
  revealAll: boolean;
  onQuery: (q: string) => void;
  onToggleMethod: (m: string) => void;
  onToggleStatus: (s: StatusClass) => void;
  onSetHost: (h: string) => void;
  onSetMime: (m: string) => void;
  onToggleReveal: () => void;
  onExport: () => void;
  onOpenPicker: () => void;
  onClear: () => void;
}

export function Toolbar(props: Props): JSX.Element {
  const { criteria, facets, shown, total, revealAll } = props;
  return (
    <div className="sift-toolbar">
      <span className="sift-brand">Sift</span>
      <input
        className="sift-search"
        type="search"
        placeholder="Filter URL, headers, body…"
        value={criteria.query}
        onChange={(e) => props.onQuery(e.target.value)}
        aria-label="Search flows"
      />

      <div className="sift-chips">
        {facets.methods.map((m) => (
          <button
            key={m}
            className="sift-chip"
            aria-pressed={criteria.methods.has(m)}
            onClick={() => props.onToggleMethod(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="sift-chips">
        {STATUS_CLASSES.map((s) => (
          <button
            key={s}
            className={`sift-chip status-${s}`}
            aria-pressed={criteria.statusClasses.has(s)}
            onClick={() => props.onToggleStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {facets.hosts.length > 1 ? (
        <select
          className="sift-chip"
          aria-label="Filter by host"
          value={[...criteria.hosts][0] ?? ""}
          onChange={(e) => props.onSetHost(e.target.value)}
        >
          <option value="">All hosts</option>
          {facets.hosts.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      ) : null}

      {facets.mimeTypes.length > 1 ? (
        <select
          className="sift-chip"
          aria-label="Filter by type"
          value={[...criteria.mimeTypes][0] ?? ""}
          onChange={(e) => props.onSetMime(e.target.value)}
        >
          <option value="">All types</option>
          {facets.mimeTypes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ) : null}

      <button
        className="sift-btn"
        aria-pressed={revealAll}
        onClick={props.onToggleReveal}
        title="Reveal or mask all sensitive values"
      >
        {revealAll ? "Mask all" : "Reveal all"}
      </button>
      <button className="sift-btn" onClick={props.onExport} title="Download a HAR with secrets stripped">
        Export sanitized HAR
      </button>
      <button className="sift-btn" onClick={props.onOpenPicker}>
        Open…
      </button>
      <button className="sift-btn" onClick={props.onClear} title="Clear all loaded flows from memory">
        Clear
      </button>

      <span className="sift-count">
        {shown === total ? `${total} flows` : `${shown} / ${total} flows`}
      </span>
    </div>
  );
}
