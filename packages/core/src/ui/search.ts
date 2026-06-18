import type { Flow, StatusClass } from "../model/flow.js";
import { statusClass } from "../model/flow.js";
import { baseMime } from "../util/mime.js";

export interface FilterCriteria {
  /** Free-text query across URL, headers, and body text. */
  query: string;
  methods: Set<string>;
  statusClasses: Set<StatusClass>;
  /** Host substrings to include (empty = all). */
  hosts: Set<string>;
  /** Base MIME types to include (empty = all). */
  mimeTypes: Set<string>;
}

export function emptyCriteria(): FilterCriteria {
  return {
    query: "",
    methods: new Set(),
    statusClasses: new Set(),
    hosts: new Set(),
    mimeTypes: new Set(),
  };
}

export function flowHost(flow: Flow): string {
  try {
    return new URL(flow.request.url).host;
  } catch {
    return "";
  }
}

export function flowScheme(flow: Flow): string {
  try {
    return new URL(flow.request.url).protocol.replace(":", "");
  } catch {
    return "";
  }
}

export function flowPath(flow: Flow): string {
  try {
    const u = new URL(flow.request.url);
    return u.pathname + u.search;
  } catch {
    return flow.request.url;
  }
}

export function responseMime(flow: Flow): string {
  return baseMime(flow.response.content.mimeType) ?? "";
}

export function flowSize(flow: Flow): number {
  return flow.response.content.size ?? flow.response.content.bytes?.length ?? 0;
}

export function flowDuration(flow: Flow): number | undefined {
  if (!flow.timings) return undefined;
  const total = flow.timings["total"];
  if (typeof total === "number") return total;
  let sum = 0;
  let any = false;
  for (const v of Object.values(flow.timings)) {
    if (typeof v === "number" && v >= 0) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : undefined;
}

function matchesQuery(flow: Flow, q: string): boolean {
  if (flow.request.url.toLowerCase().includes(q)) return true;
  for (const h of flow.request.headers) {
    if (h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)) return true;
  }
  for (const h of flow.response.headers) {
    if (h.name.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)) return true;
  }
  if (flow.request.postData?.text?.toLowerCase().includes(q)) return true;
  if (flow.response.content.text?.toLowerCase().includes(q)) return true;
  return false;
}

export function filterFlows(flows: Flow[], criteria: FilterCriteria): Flow[] {
  const q = criteria.query.trim().toLowerCase();
  return flows.filter((flow) => {
    if (criteria.methods.size && !criteria.methods.has(flow.request.method)) return false;
    if (criteria.statusClasses.size && !criteria.statusClasses.has(statusClass(flow.response.status)))
      return false;
    if (criteria.hosts.size && !criteria.hosts.has(flowHost(flow))) return false;
    if (criteria.mimeTypes.size && !criteria.mimeTypes.has(responseMime(flow))) return false;
    if (q && !matchesQuery(flow, q)) return false;
    return true;
  });
}

/** Distinct facet values across the full flow set, for quick-filter chips. */
export interface Facets {
  methods: string[];
  hosts: string[];
  mimeTypes: string[];
}

export function computeFacets(flows: Flow[]): Facets {
  const methods = new Set<string>();
  const hosts = new Set<string>();
  const mimeTypes = new Set<string>();
  for (const flow of flows) {
    methods.add(flow.request.method);
    const h = flowHost(flow);
    if (h) hosts.add(h);
    const m = responseMime(flow);
    if (m) mimeTypes.add(m);
  }
  return {
    methods: [...methods].sort(),
    hosts: [...hosts].sort(),
    mimeTypes: [...mimeTypes].sort(),
  };
}
