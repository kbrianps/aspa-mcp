export const CODES = {
  SESSION_EXPIRED: "SESSION_EXPIRED",
  BUSY: "BUSY",
  NOT_FOUND: "NOT_FOUND",
  AMBIGUOUS: "AMBIGUOUS",
  WRONG_CONVERSATION: "WRONG_CONVERSATION",
  UI_CHANGED: "UI_CHANGED",
  TIMEOUT: "TIMEOUT",
  CANCELLED: "CANCELLED",
  DUPLICATE: "DUPLICATE",
  INVALID_INPUT: "INVALID_INPUT",
  FORBIDDEN: "FORBIDDEN",
  WINDOW_CLOSED: "WINDOW_CLOSED",
  NO_DISPLAY: "NO_DISPLAY",
  NOT_VERIFIED: "NOT_VERIFIED",
  DAEMON_DOWN: "DAEMON_DOWN",
  INTERNAL: "INTERNAL",
};

export class AspaError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "AspaError";
    this.code = code;
    this.details = details;
  }
}

export const fail = (code, message, details) => {
  throw new AspaError(code, message, details);
};

export function toPayload(error) {
  if (error instanceof AspaError) return { code: error.code, error: error.message, details: error.details };
  if (error?.name === "TimeoutError") {
    return { code: CODES.TIMEOUT, error: "O painel do Aspa demorou demais para responder. Tente de novo; se continuar, o layout do Aspa pode ter mudado." };
  }
  return { code: CODES.INTERNAL, error: error?.message ?? String(error) };
}
