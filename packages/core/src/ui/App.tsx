import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Flow, StatusClass } from "../model/flow.js";
import { parseFiles, type MergeResult } from "../parsers/registry.js";
import type { ParseInput } from "../parsers/types.js";
import { downloadSanitizedHar } from "../export/sanitized-har.js";
import { computeFacets, emptyCriteria, filterFlows, type FilterCriteria } from "./search.js";
import { useFileDrop } from "./useFileDrop.js";
import { Toolbar } from "./components/Toolbar.js";
import { FlowList } from "./components/FlowList.js";
import { DetailPane } from "./components/DetailPane.js";
import { EmptyState } from "./components/EmptyState.js";

export function App(): JSX.Element {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [errors, setErrors] = useState<MergeResult["errors"]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [criteria, setCriteria] = useState<FilterCriteria>(emptyCriteria);
  const [revealAll, setRevealAll] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (inputs: ParseInput[]) => {
    const result = await parseFiles(inputs);
    setFlows(result.flows);
    setErrors(result.errors);
    setSelectedId(result.flows[0]?.id);
    setCriteria(emptyCriteria());
  }, []);

  const { dragging } = useFileDrop(handleFiles);

  const clearAll = useCallback(() => {
    setFlows([]);
    setErrors([]);
    setSelectedId(undefined);
    setCriteria(emptyCriteria());
    setRevealAll(false);
  }, []);

  // Memory hygiene: drop all parsed state when the page unloads or is hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") clearAll();
    };
    window.addEventListener("beforeunload", clearAll);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", clearAll);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [clearAll]);

  const facets = useMemo(() => computeFacets(flows), [flows]);
  const filtered = useMemo(() => filterFlows(flows, criteria), [flows, criteria]);
  const sources = useMemo(() => new Set(flows.map((f) => f.source)), [flows]);
  const selected = useMemo(
    () => flows.find((f) => f.id === selectedId),
    [flows, selectedId],
  );

  // Keyboard navigation over the filtered list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "j" && e.key !== "k") return;
      if (filtered.length === 0) return;
      e.preventDefault();
      const idx = filtered.findIndex((f) => f.id === selectedId);
      const down = e.key === "ArrowDown" || e.key === "j";
      const next = idx < 0 ? 0 : Math.min(filtered.length - 1, Math.max(0, idx + (down ? 1 : -1)));
      setSelectedId(filtered[next]?.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selectedId]);

  const onPickFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const inputs = await Promise.all(
        Array.from(list).map(async (f) => ({
          name: f.name,
          bytes: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      void handleFiles(inputs);
    },
    [handleFiles],
  );

  const toggleSet = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div className="sift-app">
      <Toolbar
        criteria={criteria}
        facets={facets}
        shown={filtered.length}
        total={flows.length}
        revealAll={revealAll}
        onQuery={(query) => setCriteria((c) => ({ ...c, query }))}
        onToggleMethod={(m) => setCriteria((c) => ({ ...c, methods: toggleSet(c.methods, m) }))}
        onToggleStatus={(s: StatusClass) =>
          setCriteria((c) => ({ ...c, statusClasses: toggleSet(c.statusClasses, s) }))
        }
        onSetHost={(h) => setCriteria((c) => ({ ...c, hosts: h ? new Set([h]) : new Set() }))}
        onSetMime={(m) => setCriteria((c) => ({ ...c, mimeTypes: m ? new Set([m]) : new Set() }))}
        onToggleReveal={() => setRevealAll((v) => !v)}
        onExport={() => downloadSanitizedHar(flows)}
        onOpenPicker={() => fileInput.current?.click()}
        onClear={clearAll}
      />

      {errors.length > 0 ? (
        <div className="sift-errors">
          <strong>Could not parse {errors.length} file(s):</strong>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>
                <code>{e.fileName}</code> — {e.error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {flows.length === 0 ? (
        <EmptyState onOpenPicker={() => fileInput.current?.click()} />
      ) : (
        <div className="sift-split">
          <FlowList
            flows={filtered}
            selectedId={selectedId}
            onSelect={(f) => setSelectedId(f.id)}
            showSource={sources.size > 1}
          />
          {selected ? (
            <DetailPane flow={selected} revealAll={revealAll} />
          ) : (
            <div className="sift-detail-pane">
              <div className="sift-no-selection">Select a flow to inspect it.</div>
            </div>
          )}
        </div>
      )}

      {dragging ? (
        <div className="sift-drop-overlay">
          <div className="msg">Drop capture files to inspect</div>
        </div>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".har,.saz,.xml,.trace,.json,application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          void onPickFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
