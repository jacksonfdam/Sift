import { useState } from "react";
import type { Cookie, Flow, Header, QueryParam } from "../../model/flow.js";
import { isSensitiveHeader, isSensitiveQueryParam } from "../../redaction/policy.js";
import { flowDuration } from "../search.js";
import { formatDuration } from "../format.js";
import { BodyView } from "./BodyView.js";
import { MaskedValue } from "./MaskedValue.js";

type TabId = "headers" | "query" | "cookies" | "request" | "response" | "timing";

interface Props {
  flow: Flow;
  revealAll: boolean;
}

export function DetailPane({ flow, revealAll }: Props): JSX.Element {
  const [tab, setTab] = useState<TabId>("headers");

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "headers", label: "Headers", count: flow.request.headers.length + flow.response.headers.length },
    { id: "query", label: "Query", count: flow.request.queryString.length },
    { id: "cookies", label: "Cookies", count: flow.request.cookies.length + flow.response.cookies.length },
    { id: "request", label: "Request body" },
    { id: "response", label: "Response body" },
    { id: "timing", label: "Timing" },
  ];

  return (
    <div className="sift-detail-pane">
      <div className="sift-req-line">
        <strong>{flow.request.method}</strong> {flow.request.url}
        {flow.response.status ? (
          <>
            {" → "}
            <strong>{flow.response.status}</strong> {flow.response.statusText ?? ""}
          </>
        ) : null}
      </div>
      <div className="sift-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`sift-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 ? <span className="badge">{t.count}</span> : null}
          </button>
        ))}
      </div>
      <div className="sift-detail-body" role="tabpanel">
        {tab === "headers" && <HeadersTab flow={flow} revealAll={revealAll} />}
        {tab === "query" && <QueryTab query={flow.request.queryString} revealAll={revealAll} />}
        {tab === "cookies" && <CookiesTab flow={flow} revealAll={revealAll} />}
        {tab === "request" && <BodyView body={flow.request.postData} label="request" />}
        {tab === "response" && <BodyView body={flow.response.content} label="response" />}
        {tab === "timing" && <TimingTab flow={flow} />}
      </div>
    </div>
  );
}

function HeadersTab({ flow, revealAll }: { flow: Flow; revealAll: boolean }): JSX.Element {
  return (
    <>
      <HeaderGroup title="Request headers" headers={flow.request.headers} revealAll={revealAll} />
      <HeaderGroup title="Response headers" headers={flow.response.headers} revealAll={revealAll} />
    </>
  );
}

function HeaderGroup({
  title,
  headers,
  revealAll,
}: {
  title: string;
  headers: Header[];
  revealAll: boolean;
}): JSX.Element {
  if (headers.length === 0) {
    return (
      <>
        <div className="sift-group-title">{title}</div>
        <div className="sift-no-selection">None</div>
      </>
    );
  }
  return (
    <>
      <div className="sift-group-title">{title}</div>
      <table className="sift-deftable">
        <tbody>
          {headers.map((h, i) => (
            <tr key={i}>
              <td className="k">{h.name}</td>
              <td className="v">
                <MaskedValue value={h.value} sensitive={isSensitiveHeader(h.name)} revealAll={revealAll} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function QueryTab({ query, revealAll }: { query: QueryParam[]; revealAll: boolean }): JSX.Element {
  if (query.length === 0) return <div className="sift-no-selection">No query parameters.</div>;
  return (
    <table className="sift-deftable">
      <tbody>
        {query.map((q, i) => (
          <tr key={i}>
            <td className="k">{q.name}</td>
            <td className="v">
              <MaskedValue value={q.value} sensitive={isSensitiveQueryParam(q.name, q.value)} revealAll={revealAll} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CookiesTab({ flow, revealAll }: { flow: Flow; revealAll: boolean }): JSX.Element {
  const hasAny = flow.request.cookies.length + flow.response.cookies.length > 0;
  if (!hasAny) return <div className="sift-no-selection">No cookies.</div>;
  return (
    <>
      <CookieGroup title="Request cookies" cookies={flow.request.cookies} revealAll={revealAll} />
      <CookieGroup title="Response cookies (Set-Cookie)" cookies={flow.response.cookies} revealAll={revealAll} />
    </>
  );
}

function CookieGroup({
  title,
  cookies,
  revealAll,
}: {
  title: string;
  cookies: Cookie[];
  revealAll: boolean;
}): JSX.Element {
  if (cookies.length === 0) return <></>;
  return (
    <>
      <div className="sift-group-title">{title}</div>
      <table className="sift-deftable">
        <tbody>
          {cookies.map((c, i) => (
            <tr key={i}>
              <td className="k">{c.name}</td>
              <td className="v">
                <MaskedValue value={c.value} sensitive revealAll={revealAll} />
                {cookieAttrs(c) ? <span style={{ color: "var(--sift-text-faint)" }}> {cookieAttrs(c)}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function cookieAttrs(c: Cookie): string {
  const attrs: string[] = [];
  for (const [k, v] of Object.entries(c)) {
    if (k === "name" || k === "value" || typeof v !== "string") continue;
    attrs.push(v === "true" ? k : `${k}=${v}`);
  }
  return attrs.length ? `· ${attrs.join("; ")}` : "";
}

function TimingTab({ flow }: { flow: Flow }): JSX.Element {
  const timings = flow.timings;
  if (!timings || Object.keys(timings).length === 0) {
    return <div className="sift-no-selection">No timing data in this capture.</div>;
  }
  const entries = Object.entries(timings).filter(([, v]) => v >= 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const total = flowDuration(flow);
  return (
    <div>
      {entries.map(([phase, ms]) => (
        <div className="sift-timing-row" key={phase}>
          <span className="sift-timing-label">{phase}</span>
          <span className="sift-timing-bar" style={{ width: `${(ms / max) * 100}%` }} />
          <span className="sift-timing-val">{formatDuration(ms)}</span>
        </div>
      ))}
      <div className="sift-timing-row" style={{ marginTop: 8, fontWeight: 600 }}>
        <span className="sift-timing-label">total</span>
        <span />
        <span className="sift-timing-val">{formatDuration(total)}</span>
      </div>
    </div>
  );
}
