# Security review — 18 October 2026

## Dependency results

The full npm dependency tree was reviewed, including runtime, optional, development, and transitive packages. The committed lockfile records the tested versions.

| Check | Before | After |
| --- | --- | --- |
| `npm audit --omit=dev` | 17 affected dependency entries (2 critical, 11 high, 4 moderate) | 0 |
| `npm audit` | 29 affected dependency entries (2 critical, 18 high, 8 moderate, 1 low) | 7 high entries, all caused by one unpatched build-tool dependency |

Audit entry counts include affected parent packages. Against the previous lockfile, npm's registry reported 50 unique advisory URLs. Hostinger uses its own scanner and deployed installation, so its reported 63 findings cannot be matched individually without its detailed report.

### Updated packages

- Next.js and its ESLint configuration: 15.5.28.
- Express: 4.22.3; Helmet: 8.3.0; proxy-addr: 2.0.8.
- Socket.IO server/client: 4.8.4; parser: 4.2.7; Engine.IO: 6.6.11; ws: 8.21.3.
- React and React DOM: 19.3.1; sharp: 0.35.5.
- PostCSS: 8.5.30; postcss-selector-parser: 7.1.6 through a tested override for the older CSS tooling.
- Vitest: 4.1.12; Vite: 8.3.4; esbuild: 0.28.2; tsx: 4.23.15; ESLint: 9.39.5, supported by the current Next.js lint configuration. Compatible transitive and type-package updates are also locked.
- Removed unused cross-env and the redundant direct dependency on @next/eslint-plugin-next. The latter is still supplied by the development-only eslint-config-next dependency.

Unrelated major migrations (Express 5, Next.js 16, Tailwind 4, ESLint 10, TypeScript 7, and Lucide 1) were not required to patch the runtime vulnerabilities and were not applied. `npm outdated` can therefore still list these newer major releases.

### Remaining build-tool issue

`braces` 3.0.3 has a deeply nested pattern stack-exhaustion vulnerability, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). No patched release is published as of this review. It is pulled in by Tailwind and the Next.js lint tools through chokidar, micromatch, and fast-glob. Those parent packages account for the seven full-audit entries.

This dependency is development-only. The application does not accept user-supplied glob patterns or invoke these tools from HTTP or socket handlers. Keep untrusted content out of build/lint configuration, and revisit this advisory when upstream publishes a fix. The alert has not been suppressed, and no dependency versions have been falsified to hide it.

npm also marks ESLint 9 as deprecated. Version 9.39.5 is the newest release accepted by the current Next.js 15 lint configuration; moving to ESLint 10 requires a separate lint-toolchain migration. Deprecation warnings and audit vulnerability counts are reported separately.

## Application protections

- Socket event middleware rejects malformed callback positions and extra arguments before handlers run.
- Lobby creation/join limits are keyed to verified client addresses, so reconnecting cannot reset them. Roll and DM-control limits follow server-authenticated player IDs.
- Per-address connection and overall event limits bound repeated connection/event abuse.
- Express and Socket.IO trust only the configured proxy IPs/CIDRs. Direct clients cannot choose their address using forwarded headers.
- Session credentials remain private, DM controls require the bound host identity, and private rolls are filtered per viewer.

## Deployment and verification

Use Node.js 22 or 24 LTS. Configure trusted proxy addresses as described in [HOSTINGER_DEPLOYMENT.md](./HOSTINGER_DEPLOYMENT.md), commit the lockfile, install with `npm ci`, and redeploy so Hostinger scans the new installation. Do not use `npm audit fix --force`: its suggestions include unrelated major changes and do not provide a published patch for the remaining braces issue.

Verification passed on Node.js 22.23.3: 110 automated tests, TypeScript checks, linting, a production build, and a clean installation from the lockfile. The production server also passed local malformed-packet, reconnect-limit, and proxy-header checks. A two-browser smoke test covered joining, refreshing, public rolls, and DM-only rolls. No live Hostinger deployment or scanner configuration was changed in this review.
