# Onlook Web Client

This is the Next.js App Router client for the standalone Onlook app.

## Runtime Model

- Convex owns app metadata, frames, conversations, messages, settings, checkpoints, uploads, and realtime app state.
- The local runtime owns filesystem access, project watchers, installs, dev processes, command execution, logs, preview ports, and runtime SSE events.
- Project source files live under `.onlook/sandboxes/<project-id>`.

## Development

Use Bun workspace scripts from the repository root:

```bash
bun --filter @onlook/web-client typecheck
```

Do not introduce Supabase, tRPC, CodeSandbox, Docker, SaaS auth, billing, teams, or app-level branches into this client.
