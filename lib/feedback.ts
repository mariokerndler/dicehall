export const MAX_FEEDBACK_MESSAGE_LENGTH = 2_000;
const MAX_PAGE_CONTEXT_LENGTH = 40;

export type FeedbackType = "bug" | "feature";

export type NormalizedFeedback = {
  type: FeedbackType;
  message: string;
  pageContext?: string;
};

export type StoredFeedback = NormalizedFeedback & {
  id: string;
  createdAt: string;
};

export type FeedbackValidationResult =
  | { ok: true; data: NormalizedFeedback }
  | { ok: false; error: string };

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isFeedbackType(value: unknown): value is FeedbackType {
  return value === "bug" || value === "feature";
}

export function normalizeFeedbackPayload(payload: unknown): FeedbackValidationResult {
  const input = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const type = input.type;
  const message = readString(input.message).trim();
  const pageContext = readString(input.pageContext).trim();

  if (!isFeedbackType(type)) {
    return { ok: false, error: "Invalid feedback submission." };
  }

  if (!message || message.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
    return { ok: false, error: "Invalid feedback submission." };
  }

  if (pageContext.length > MAX_PAGE_CONTEXT_LENGTH) {
    return { ok: false, error: "Invalid feedback submission." };
  }

  return {
    ok: true,
    data: {
      type,
      message,
      ...(pageContext ? { pageContext } : {})
    }
  };
}
