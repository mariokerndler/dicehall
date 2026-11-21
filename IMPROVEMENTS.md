# Web app improvements

Review date: 2026-11-21. Scope: focused reliability, accessibility, and developer checks using existing components and dependencies.

## Checklist

- [ ] **P1 — Tolerate unavailable or malformed session storage.** Storage access currently happens outside error handling, and parsed values are trusted. A storage exception can interrupt accepting a lobby. Keep the active session usable in memory and validate saved fields. Reach: home session helpers and regression tests. Limit: refreshing cannot restore a session when storage is blocked.
- [ ] **P1 — Block invalid dice rolls before sending.** The preview catches validation failures, but Roll stays enabled and only says “Fix dice selection.” Reuse the server's validator to show the actual error and disable invalid submissions. Reach: DiceRoller and existing dice validation tests.
- [ ] **P2 — Make feedback a keyboard-accessible modal.** The current dialog lacks focus containment, Escape handling, and focus restoration. Use the native dialog, keep it usable on short screens, announce submission results, and avoid editing a request while it sends. Reach: FeedbackButton.
- [ ] **P2 — Support Enter and input constraints in lobby forms.** Create/join use plain containers and click handlers. Use forms, require names and a six-character code, cap names consistently with the server, and announce errors. Reach: home create/join UI; retain server validation.
- [ ] **P2 — Handle clipboard denial.** Copy currently throws if clipboard access is unavailable or denied. Show a useful fallback message with the visible, selectable code. Reach: LobbyHeader.
- [ ] **P2 — Repair the lint command.** Check the installed ESLint/Next integration and make `npm run lint` work without interactive setup. Reach: package scripts/config and README.

## Verification

- Baseline: 9 test files, 110 tests passed.
- Final checks and outcomes will be recorded here after implementation.

## Scope limits

No deployment, persistent lobby database, new dependencies, or visual redesign is included in this pass. Lobbies remain in memory as documented in README.
