interface Props {
  onOpenPicker: () => void;
}

export function EmptyState({ onOpenPicker }: Props): JSX.Element {
  return (
    <div className="sift-empty">
      <h1>Drop a capture to inspect it</h1>
      <div className="formats">
        <span className="sift-badge">HAR (.har)</span>
        <span className="sift-badge">Fiddler (.saz)</span>
        <span className="sift-badge">Charles (.xml / .trace)</span>
      </div>
      <button className="sift-btn pick" onClick={onOpenPicker}>
        Choose file…
      </button>
      <p className="privacy">
        Everything happens in this page. Nothing leaves it, and nothing is saved —
        captures are parsed in memory and discarded on reload. Sensitive headers,
        cookies, and tokens are masked by default; click a value to reveal it.
      </p>
    </div>
  );
}
