import type { Flow } from "../model/flow.js";
import { harParser } from "./har.js";
import { sazParser } from "./saz.js";
import { charlesParser } from "./charles.js";
import { ParserError, type FlowParser, type ParseInput } from "./types.js";

/** Ordered so extension/magic sniffing is unambiguous; HAR is the hub format. */
export const PARSERS: readonly FlowParser[] = [harParser, sazParser, charlesParser];

export interface ParseFileResult {
  fileName: string;
  flows: Flow[];
  parser: FlowParser["id"];
}

/** Detect refusable formats we explicitly do not support (clear guidance). */
function rejectKnownUnsupported(input: ParseInput): void {
  if (/\.(chls|chlsj|tcpsf)$/i.test(input.name)) {
    throw new ParserError(
      "unsupported",
      "Charles .chls/.tcpsf uses Java serialization, which can't be read in the browser. Export HAR from that tool instead.",
      { fileName: input.name },
    );
  }
  if (/\.(pcap|pcapng|cap)$/i.test(input.name)) {
    throw new ParserError(
      "unsupported",
      "Packet captures (pcap/pcapng) aren't supported. Export HAR from your tool instead.",
      { fileName: input.name },
    );
  }
}

/** Find the first parser whose cheap sniff accepts the input. */
export async function detectParser(input: ParseInput): Promise<FlowParser | undefined> {
  for (const parser of PARSERS) {
    if (await parser.canParse(input)) return parser;
  }
  return undefined;
}

/**
 * Parse a single dropped file into flows. Throws a typed {@link ParserError}
 * on unsupported/malformed input. Indices are assigned by the caller across
 * the merged set, so flows here are 0-based and re-indexed on merge.
 */
export async function parseFile(input: ParseInput): Promise<ParseFileResult> {
  if (input.bytes.length === 0) {
    throw new ParserError("empty", "File is empty.", { fileName: input.name });
  }
  rejectKnownUnsupported(input);

  const parser = await detectParser(input);
  if (!parser) {
    throw new ParserError(
      "unsupported",
      "Unrecognized format. Supported: HAR (.har), Fiddler (.saz), Charles (.xml/.trace).",
      { fileName: input.name },
    );
  }
  const flows = await parser.parse(input);
  return { fileName: input.name, flows, parser: parser.id };
}

/**
 * Parse many files and merge into a single, re-indexed flow list. Each file's
 * outcome is reported independently so one bad file doesn't sink the rest.
 */
export interface MergeResult {
  flows: Flow[];
  ok: ParseFileResult[];
  errors: { fileName: string; error: ParserError }[];
}

export async function parseFiles(inputs: ParseInput[]): Promise<MergeResult> {
  const ok: ParseFileResult[] = [];
  const errors: { fileName: string; error: ParserError }[] = [];

  for (const input of inputs) {
    try {
      ok.push(await parseFile(input));
    } catch (err) {
      const error =
        err instanceof ParserError
          ? err
          : new ParserError("internal", "Could not parse file.", {
              fileName: input.name,
            });
      errors.push({ fileName: input.name, error });
    }
  }

  // Merge in file order, re-assign global index and unique ids.
  const flows: Flow[] = [];
  let index = 0;
  for (const result of ok) {
    for (const flow of result.flows) {
      flows.push({ ...flow, index, id: `${flow.source}-${index}` });
      index++;
    }
  }
  return { flows, ok, errors };
}
