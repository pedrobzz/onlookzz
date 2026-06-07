## Onlook Agents Guide

Actionable rules for repo agents: keep diffs minimal, safe, and aligned with the standalone local app architecture.

### Purpose & Scope

- Audience: automated coding agents working within this repository.
- Goal: small, correct diffs aligned with the project architecture.
- Non-goals: editing generated artifacts, lockfiles, or `node_modules`.

### Repo Map

- Monorepo managed by Bun workspaces.
- App: `apps/web/client` (Next.js App Router + TailwindCSS).
- App metadata and realtime state: `apps/web/client/convex`.
- Local runtime and filesystem/process APIs: `packages/file-system`.
- Shared utilities and types: `packages/*`.

### Stack & Runtimes

- UI: Next.js App Router, TailwindCSS.
- App data: Convex queries and mutations.
- Runtime data: local Elysia runtime for files, commands, process logs, preview ports, and SSE events.
- Package manager: Bun only. Do not use npm, yarn, or pnpm.

### Agent Priorities

- Correctness first: minimal scope and targeted edits.
- Respect client/server boundaries in App Router.
- Prefer Convex for app metadata and realtime app state.
- Prefer the local runtime for filesystem, command, process, log, and preview work.
- Do not reintroduce auth, users, teams, billing, Stripe, Supabase, tRPC, CodeSandbox, Docker, app-level branches, or provider indirection.
- Do not modify build outputs, generated files, lockfiles, or `node_modules`.
- Avoid running the local dev server in automation contexts.

### Next.js App Router

- Default to Server Components. Add `use client` when using events, state/effects, browser APIs, or client-only libraries.
- App structure: `apps/web/client/src/app/**` (`page.tsx`, `layout.tsx`, `route.ts`).
- Client providers live behind a client boundary.
- Components using `mobx-react-lite`'s `observer` must be client components or live below a client component boundary.

### Convex

- Convex owns projects, frames, conversations, messages, settings, checkpoints, uploads, and realtime app subscriptions.
- Keep schemas single-user and direct. Do not add user-scoped tables, members, invitations, subscriptions, or SaaS-only relations.
- Store project metadata in Convex. Do not store project source file contents or filesystem watcher events in Convex.
- Use generated Convex APIs through the existing local Convex client/provider patterns.

### Local Runtime

- Project source files live under `.onlook/sandboxes/<project-id>`.
- Use the local runtime for reading, writing, renaming, deleting, and listing project files.
- Use the local runtime for installs, dev process control, one-shot commands, logs, preview ports, and runtime SSE.
- Treat `projectId` as the runtime identifier. Do not add `branchId`, `sandboxId`, branch fallback behavior, or app-level branch UI.

### Env & Config

- Define and validate env vars in `apps/web/client/src/env.ts`.
- Expose browser vars with `NEXT_PUBLIC_*` and declare them in the client schema.
- Prefer `env` from `@/env`. Avoid new `process.env` reads in client code.
- Import `./src/env` in `apps/web/client/next.config.ts` to enforce validation.

### Imports & Paths

- Use path aliases: `@/*` and `~/*` map to `apps/web/client/src/*`.
- Do not import server-only modules into client components.
- Split code by environment if needed.

### MobX + React Stores

- Create store instances with `useState(() => new Store())` for stability across renders.
- Keep active store in `useRef`; clean up async with `setTimeout(() => storeRef.current?.clear(), 0)` to avoid route-change races.
- Avoid `useMemo` for store instances.
- Avoid putting a store instance in effect deps if it loops; split concerns by project and data source.

### Styling & UI

- TailwindCSS-first styling; global styles are imported in `apps/web/client/src/app/layout.tsx`.
- Prefer existing UI components from `@onlook/ui` and local patterns.
- Preserve dark theme defaults via `ThemeProvider` usage in layout.

### Internationalization

- `next-intl` is configured; provider lives in `apps/web/client/src/app/layout.tsx`.
- Strings live in `apps/web/client/messages/*`. Add or modify keys there; avoid hardcoded user-facing text.

### Common Pitfalls

- Missing `use client` where needed causes unbound events.
- Importing server-only code into client components causes bundling/runtime errors.
- Reintroducing SaaS concepts creates dead state and UI.
- Writing files outside the local runtime bypasses cache, watcher, and SSE contracts.
- Bypassing i18n by hardcoding strings instead of using message files/hooks.

### Context Discipline

- Search narrowly with ripgrep; open only files you need.
- Read small sections; avoid `node_modules`, `.next`, generated bundles, large assets, and lockfiles.
- Propose minimal diffs aligned with existing conventions.

### Notes

- Unit tests can be run with `bun test`.
- Run type checking with `bun run typecheck` or focused workspace filters.
- Refrain from running the dev server unless explicitly asked.
- DO NOT run `db:gen`.
- DO NOT use `any` unless necessary.
