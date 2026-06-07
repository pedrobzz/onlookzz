import { Buffer } from 'node:buffer';

import { cors } from '@elysiajs/cors';
import { Elysia, t } from 'elysia';

import { encodeSse, eventBus } from './events';
import { createDirectory, deletePath, ensureProjectRoot, listAll, readFile, readTree, renamePath, writeFile } from './files';
import { getLogs, getStatus, restartDev, runCommand, startDev, startInstall, stopProcess } from './processes';
import { watchProject } from './watch';

const port = Number(process.env.ONLOOK_RUNTIME_PORT ?? 4317);

const pathBody = t.Object({
  path: t.String(),
  operationId: t.Optional(t.String()),
});

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ ok: true }))
  .get('/projects/:id/tree', async ({ params, query }) => {
    await ensureProjectRoot(params.id);
    watchProject(params.id);
    return readTree(params.id, typeof query.path === 'string' ? query.path : '.');
  })
  .get('/projects/:id/files/read', async ({ params, query }) => {
    if (typeof query.path !== 'string') {
      throw new Error('Missing path');
    }
    await ensureProjectRoot(params.id);
    watchProject(params.id);
    return readFile(params.id, query.path);
  })
  .get('/projects/:id/files/list', async ({ params }) => {
    await ensureProjectRoot(params.id);
    watchProject(params.id);
    return listAll(params.id);
  })
  .post('/projects/:id/files/write', async ({ params, body }) => {
    await ensureProjectRoot(params.id);
    watchProject(params.id);
    const content = body.encoding === 'base64'
      ? Uint8Array.from(Buffer.from(body.content, 'base64'))
      : body.content;
    await writeFile(params.id, body.path, content, body.operationId);
    return { ok: true };
  }, {
    body: t.Object({
      path: t.String(),
      content: t.String(),
      encoding: t.Optional(t.Union([t.Literal('utf8'), t.Literal('base64')])),
      operationId: t.Optional(t.String()),
    }),
  })
  .post('/projects/:id/files/rename', async ({ params, body }) => {
    await ensureProjectRoot(params.id);
    watchProject(params.id);
    await renamePath(params.id, body.oldPath, body.newPath, body.operationId);
    return { ok: true };
  }, {
    body: t.Object({
      oldPath: t.String(),
      newPath: t.String(),
      operationId: t.Optional(t.String()),
    }),
  })
  .post('/projects/:id/files/directory', async ({ params, body }) => {
    await ensureProjectRoot(params.id);
    watchProject(params.id);
    await createDirectory(params.id, body.path, body.operationId);
    return { ok: true };
  }, {
    body: pathBody,
  })
  .post('/projects/:id/files/delete', async ({ params, body }) => {
    await deletePath(params.id, body.path, body.operationId);
    return { ok: true };
  }, {
    body: pathBody,
  })
  .get('/projects/:id/events', ({ params }) => {
    watchProject(params.id);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (message: string) => controller.enqueue(encoder.encode(message));
        send(encodeSse({
          type: 'tree:changed',
          projectId: params.id,
          path: '.',
          source: 'api',
          version: 0,
          modifiedTime: Date.now(),
        }));

        const unsubscribe = eventBus.subscribe(params.id, (event) => {
          send(encodeSse(event));
        });

        return () => unsubscribe();
      },
    });

    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
    });
  })
  .post('/projects/:id/install', ({ params }) => startInstall(params.id))
  .get('/projects/:id/install/status', ({ params }) => getStatus(params.id, 'install'))
  .get('/projects/:id/install/logs', ({ params }) => getLogs(params.id, 'install'))
  .post('/projects/:id/dev/start', ({ params }) => startDev(params.id))
  .post('/projects/:id/dev/restart', ({ params }) => restartDev(params.id))
  .post('/projects/:id/dev/stop', ({ params }) => stopProcess(params.id, 'dev'))
  .get('/projects/:id/dev/status', ({ params }) => getStatus(params.id, 'dev'))
  .get('/projects/:id/dev/logs', ({ params }) => getLogs(params.id, 'dev'))
  .post('/projects/:id/commands/run', ({ params, body }) => runCommand(params.id, body.command, body.args, body.cwd), {
    body: t.Object({
      command: t.String(),
      args: t.Optional(t.Array(t.String())),
      cwd: t.Optional(t.String()),
      operationId: t.Optional(t.String()),
    }),
  })
  .listen(port);

console.log(`Onlook runtime listening on http://localhost:${app.server?.port ?? port}`);
