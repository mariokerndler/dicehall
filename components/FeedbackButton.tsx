"use client";

import { Bug, Lightbulb, MessageSquare, Send, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { MAX_FEEDBACK_MESSAGE_LENGTH, type FeedbackType } from "../lib/feedback";

type FeedbackButtonProps = {
  pageContext: "home" | "lobby";
  variant?: "button" | "link";
};

type SubmitState = "idle" | "submitting" | "success" | "error";

const feedbackOptions: Array<{ type: FeedbackType; label: string; icon: typeof Bug }> = [
  { type: "bug", label: "Bug", icon: Bug },
  { type: "feature", label: "Feature", icon: Lightbulb }
];

export function FeedbackButton({ pageContext, variant = "button" }: FeedbackButtonProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const remainingCharacters = MAX_FEEDBACK_MESSAGE_LENGTH - message.length;
  const canSubmit = useMemo(
    () => message.trim().length > 0 && message.length <= MAX_FEEDBACK_MESSAGE_LENGTH && submitState !== "submitting",
    [message, submitState]
  );

  function closeModal() {
    dialogRef.current?.close();
  }

  async function submitFeedback() {
    if (!canSubmit) {
      return;
    }

    setSubmitState("submitting");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          message,
          pageContext
        })
      });

      if (!response.ok) {
        setSubmitState("error");
        return;
      }

      setMessage("");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={variant === "link"
          ? "transition hover:text-brass focus:text-brass focus:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950"
          : "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-bold text-stone-200 transition hover:border-brass/60 hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass"}
      >
        {variant === "button" ? <MessageSquare size={16} /> : null}
        Feedback
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setSubmitState("idle")}
        onCancel={(event) => { if (submitState === "submitting") event.preventDefault(); }}
        aria-labelledby="feedback-title"
        aria-busy={submitState === "submitting"}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-ink-900 p-6 text-base font-normal text-stone-50 shadow-card backdrop:bg-ink-950/80"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="feedback-title" className="text-xl font-bold text-stone-50">
              Send anonymous feedback
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Do not include names, emails, lobby codes, or other personal data.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            disabled={submitState === "submitting"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-300 transition hover:border-brass/60 hover:text-brass focus:outline-none focus:ring-2 focus:ring-brass"
            aria-label="Close feedback form"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {feedbackOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = type === option.type;

            return (
              <button
                key={option.type}
                type="button"
                onClick={() => setType(option.type)}
                disabled={submitState === "submitting"}
                aria-pressed={isSelected}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-brass ${
                  isSelected
                    ? "border-brass bg-brass/15 text-brass"
                    : "border-white/10 bg-white/[0.035] text-stone-200 hover:border-brass/60"
                }`}
              >
                <Icon size={17} />
                {option.label}
              </button>
            );
          })}
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-semibold text-stone-300">What happened or what should improve?</span>
          <textarea
            disabled={submitState === "submitting"}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (submitState !== "submitting") {
                setSubmitState("idle");
              }
            }}
            maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
            rows={7}
            className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-ink-950/60 px-3 py-3 text-stone-50 outline-none placeholder:text-stone-400 focus:border-brass focus:ring-2 focus:ring-brass/30"
            placeholder="Describe the issue or idea without personal details."
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
          <span className={`tabular-nums ${remainingCharacters < 0 ? "text-crimson" : "text-stone-400"}`}>
            {remainingCharacters} characters left
          </span>
          <span role="status" className={submitState === "error" ? "text-crimson" : submitState === "success" ? "success-pulse text-brass" : "text-brass"}>
            {submitState === "success" ? "Thanks, feedback saved." : submitState === "error" ? "Could not send feedback. Try again." : ""}
          </span>
        </div>

        <button
          type="button"
          onClick={submitFeedback}
          disabled={!canSubmit}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 text-sm font-bold text-ink-950 transition hover:bg-[#e2ad66] focus:outline-none focus:ring-2 focus:ring-brass disabled:opacity-50"
        >
          <Send size={17} />
          {submitState === "submitting" ? "Sending" : "Send Feedback"}
        </button>
      </dialog>
    </>
  );
}
