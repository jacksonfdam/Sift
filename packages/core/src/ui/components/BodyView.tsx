import { useMemo, useState } from "react";
import type { Body } from "../../model/flow.js";
import { bodyKind } from "../../util/mime.js";
import { formatBytes } from "../format.js";
import { prettyPrint } from "../format.js";
import { highlight } from "../highlight.js";

/** Bodies larger than this are guarded behind an explicit "render anyway". */
const LARGE_BODY = 512 * 1024;

interface Props {
  body: Body | undefined;
  label: string;
}

export function BodyView({ body, label }: Props): JSX.Element {
  const [force, setForce] = useState(false);

  if (!body || (body.text === undefined && (!body.bytes || body.bytes.length === 0))) {
    return <div className="sift-no-selection">No {label} body.</div>;
  }

  const kind = bodyKind(body.mimeType);
  const size = body.size ?? body.bytes?.length ?? 0;

  return (
    <div>
      <div className="sift-body-meta">
        <span className="sift-badge">{body.mimeType || "unknown type"}</span>
        <span>{formatBytes(size)}</span>
        {body.encoding ? <span className="sift-badge">{body.encoding}</span> : null}
        {body.truncated ? <span className="sift-badge warn">truncated</span> : null}
        {body.undecodedEncoding ? (
          <span className="sift-badge warn">
            {body.undecodedEncoding === "br" ? "Brotli body — not decoded" : `${body.undecodedEncoding} — not decoded`}
          </span>
        ) : null}
      </div>
      <BodyContent body={body} kind={kind} size={size} force={force} onForce={() => setForce(true)} />
    </div>
  );
}

function BodyContent({
  body,
  kind,
  size,
  force,
  onForce,
}: {
  body: Body;
  kind: ReturnType<typeof bodyKind>;
  size: number;
  force: boolean;
  onForce: () => void;
}): JSX.Element {
  // Binary or undecoded: show a byte summary, never dump raw bytes as text.
  if (body.text === undefined || body.undecodedEncoding) {
    return (
      <div className="sift-guard">
        Binary body ({formatBytes(size)}). Not shown as text.
      </div>
    );
  }

  if (size > LARGE_BODY && !force) {
    return (
      <div className="sift-guard">
        <p>Large body ({formatBytes(size)}). Rendering may be slow.</p>
        <button className="sift-btn" onClick={onForce}>
          Render anyway
        </button>
      </div>
    );
  }

  return <Highlighted text={body.text} kind={kind} />;
}

function Highlighted({ text, kind }: { text: string; kind: ReturnType<typeof bodyKind> }): JSX.Element {
  const tokens = useMemo(() => {
    const pretty = prettyPrint(text, kind);
    return highlight(pretty, kind);
  }, [text, kind]);

  return (
    <pre className="sift-pre">
      {tokens.map((t, i) =>
        t.cls === "plain" ? (
          t.text
        ) : (
          <span key={i} className={`tok-${t.cls}`}>
            {t.text}
          </span>
        ),
      )}
    </pre>
  );
}
