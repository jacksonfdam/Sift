import type { Flow } from "../model/flow.js";

export interface ParseInput {
  /** Original file name; used for extension sniffing. */
  name: string;
  bytes: Uint8Array;
}

export type ParserId = "har" | "saz" | "charles";

export interface FlowParser {
  id: ParserId;
  /** Cheap sniff: extension + magic bytes. Does NOT fully parse. */
  canParse(input: ParseInput): boolean | Promise<boolean>;
  /** Throws a typed {@link ParserError} on malformed/unsupported input. */
  parse(input: ParseInput): Promise<Flow[]>;
}

export type ParserErrorCode =
  | "unsupported"
  | "malformed"
  | "encrypted"
  | "empty"
  | "internal";

/**
 * A typed, non-leaky parse error. Messages MUST NOT echo capture contents —
 * no header or body fragments. The optional `fileName` is safe to surface.
 */
export class ParserError extends Error {
  readonly code: ParserErrorCode;
  readonly parser?: ParserId;
  readonly fileName?: string;

  constructor(
    code: ParserErrorCode,
    message: string,
    opts?: { parser?: ParserId; fileName?: string; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "ParserError";
    this.code = code;
    if (opts?.parser) this.parser = opts.parser;
    if (opts?.fileName) this.fileName = opts.fileName;
  }
}
