import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import staticPlugin from '@fastify/static';
import Fastify from 'fastify';
import { awsCheckRoutes } from './routes/aws.js';
import { projectRoutes } from './routes/project.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export async function createServer() {
  const app = Fastify({ logger: false });

  // DNS-rebinding protection: only accept requests with a loopback Host header.
  app.addHook('onRequest', async (req, reply) => {
    const host = req.headers.host?.split(':')[0] ?? '';
    if (!ALLOWED_HOSTS.has(host)) {
      reply.code(403).send({ error: 'Forbidden host' });
    }
  });

  await app.register(awsCheckRoutes, { prefix: '/api' });
  await app.register(projectRoutes, { prefix: '/api' });

  const publicDir = join(__dirname, 'public');
  await app.register(staticPlugin, {
    root: publicDir,
    prefix: '/',
    decorateReply: false,
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile('index.html');
  });

  return app;
}

export async function startServer(port = 3847) {
  const app = await createServer();
  await app.listen({ port, host: '127.0.0.1' });
  return `http://localhost:${port}`;
}
