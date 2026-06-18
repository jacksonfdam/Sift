// Canonical model
export type {
  Body,
  Cookie,
  Flow,
  FlowRequest,
  FlowResponse,
  FlowSource,
  Header,
  QueryParam,
  StatusClass,
} from "./model/flow.js";
export { statusClass } from "./model/flow.js";

// Parser contract + registry
export type { FlowParser, ParseInput, ParserId, ParserErrorCode } from "./parsers/types.js";
export { ParserError } from "./parsers/types.js";
export {
  PARSERS,
  detectParser,
  parseFile,
  parseFiles,
  type MergeResult,
  type ParseFileResult,
} from "./parsers/registry.js";
export { harParser } from "./parsers/har.js";
export { sazParser } from "./parsers/saz.js";
export { charlesParser } from "./parsers/charles.js";

// Redaction
export {
  isSensitiveHeader,
  isSensitiveCookie,
  isSensitiveQueryParam,
  shouldMaskHeader,
  shouldMaskCookie,
  shouldMaskQueryParam,
  maskedDisplay,
  flowHasSecrets,
  REDACTED_PLACEHOLDER,
} from "./redaction/policy.js";

// Export
export { buildSanitizedHar, downloadSanitizedHar } from "./export/sanitized-har.js";

// Selected utilities reused by targets
export { bodyKind, isTextualMime, baseMime } from "./util/mime.js";
export type { BodyKind } from "./util/mime.js";
