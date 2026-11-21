# Web app improvements

Review date: 2026-11-21. Scope: focused reliability, accessibility, and developer checks using existing components and dependencies.

## Checklist

- [x] **P1 — Tolerate unavailable or malformed session storage.** Storage access currently happens outside error handling, and parsed values are trusted. A storage exception can interrupt accepting a lobby. Keep the active session usable in memory and validate saved fields. Reach: home session helpers and regression tests. Limit: refreshing cannot restore a session when storage is blocked.
- [x] **P1 — Block invalid dice rolls before sending.** The preview catches validation failures, but Roll stays enabled and only says “Fix dice selection.” Reuse the server's validator to show the actual error and disable invalid submissions. Reach: DiceRoller and existing dice validation tests.
- [x] **P2 — Make feedback a keyboard-accessible modal.** The current dialog lacks focus containment, Escape handling, and focus restoration. Use the native dialog, keep it usable on short screens, announce submission results, and avoid editing a request while it sends. Reach: FeedbackButton.
- [x] **P2 — Support Enter and input constraints in lobby forms.** Create/join use plain containers and click handlers. Use forms, require names and a six-character code, cap names consistently with the server, and announce errors. Reach: home create/join UI; retain server validation.
- [x] **P2 — Handle clipboard denial.** Copy currently throws if clipboard access is unavailable or denied. Show a useful fallback message with the visible, selectable code. Reach: LobbyHeader.
- [x] **P2 — Migrate the deprecated lint command.** The baseline `next lint` worked but warned that it will be removed. Use the installed ESLint CLI and a flat config without interactive setup. Reach: package scripts/config and README.

## Verification

- Baseline: 9 test files, 110 tests passed.
- Final automated checks: 10 test files, 118 tests passed; ESLint passed without warnings; TypeScript passed; production Next.js and custom server builds passed.
- Browser checks against the production build: created and joined a lobby using Enter in two tabs, restored the host session after refresh, disabled Roll for quantity 21 with a specific error, corrected the input and observed a committed roll, and copied the lobby code successfully.
- Feedback checks: native modal opened with close-button focus; Escape closed it and restored focus to the trigger. At 390 x 600 the dialog stayed within the viewport and scrolled. No new animation was introduced.
- Not exercised in the browser: clipboard-denial branch, feedback timeout/error/submission states, assistive technology, or additional browser engines. Storage failure and malformed values are covered by unit tests.

## Delivery

Implemented on `codex/web-app-improvements`, with one commit for each checklist item plus checklist documentation commits. Pull request targets `main`.

## Scope limits

No deployment, persistent lobby database, new dependencies, or visual redesign is included in this pass. Lobbies remain in memory as documented in README.
