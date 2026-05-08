import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { awsCheckRoutes } from './routes/aws.js';
import { projectRoutes } from './routes/project.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createServer() {
  const app = Fastify({ logger: false });

  // API routes
  await app.register(awsCheckRoutes, { prefix: '/api' });
  await app.register(projectRoutes, { prefix: '/api' });

  // Serve React build (in production mode, dist/public exists next to dist/bin.js)
  const publicDir = join(__dirname, 'public');
  await app.register(staticPlugin, {
    root: publicDir,
    prefix: '/',
    decorateReply: false,
  });

  // SPA fallback
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
