import archiver from 'archiver';
import type { FastifyPluginAsync } from 'fastify';
import { render } from '../../renderer/template-engine.js';
import { getTemplates } from '../../templates/index.js';
import { buildVars, rawVarsFromInput } from '../../vars.js';

const generateBodySchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    projectName: { type: 'string', maxLength: 100 },
    awsRegion: { type: 'string', maxLength: 30 },
    projectType: { type: 'string', enum: ['cms', 'api', 'static'] },
    authStrategy: { type: 'string', enum: ['cognito-kms', 'cognito', 'none'] },
    tenantIsolation: { type: 'string', enum: ['single-table', 'separate-tables'] },
    expectedTenantCount: { type: 'string', enum: ['<75', '75+'] },
    editorDomain: { type: 'string', maxLength: 253 },
    githubOrgRepo: { type: 'string', maxLength: 100 },
    githubBranch: { type: 'string', maxLength: 100 },
    devAccountId: { type: 'string', maxLength: 12 },
    prodAccountId: { type: 'string', maxLength: 12 },
    generateStaging: { type: 'boolean' },
  },
} as const;

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/project/generate',
    {
      schema: { body: generateBodySchema },
      bodyLimit: 16 * 1024,
    },
    async (req, reply) => {
      const raw = rawVarsFromInput(req.body as Record<string, unknown>);
      const vars = buildVars(raw);
      const templates = getTemplates(vars);

      reply.raw.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${vars.projectName}.zip"`,
      });

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(reply.raw);

      for (const t of templates) {
        const content = render(t.template, vars);
        archive.append(content, { name: `${vars.projectName}/${t.outputPath}` });
      }

      await archive.finalize();
    },
  );
};
