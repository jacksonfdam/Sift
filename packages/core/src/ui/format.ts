/** Display formatting helpers. Pure and side-effect free. */

export function formatBytes(n: number | undefined): string {
  if (n === undefined || n < 0) return "—";
  if (n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const value = n / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms < 0) return "—";
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Pretty-print body text when it parses as JSON; otherwise return as-is. */
export function prettyPrint(text: string, kind: string): string {
  if (kind === "json") {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}
