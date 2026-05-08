import type { FastifyPluginAsync } from 'fastify';
import archiver from 'archiver';
import { getTemplates } from '../../templates/index.js';
import { render } from '../../renderer/template-engine.js';
import type { TemplateVars } from '../../types.js';

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.post('/project/generate', async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    const projectName = String(body.projectName ?? 'my-project').toLowerCase().replace(/\s+/g, '-');
    const authStrategy = (body.authStrategy as 'cognito-kms' | 'cognito' | 'none') ?? 'none';
    const projectType = (body.projectType as 'cms' | 'api' | 'static') ?? 'api';

    const vars: TemplateVars = {
      projectName,
      projectNameUpper: projectName.toUpperCase().replace(/-/g, '_'),
      awsRegion: String(body.awsRegion ?? 'us-west-2'),
      devAccountId: String(body.devAccountId ?? ''),
      prodAccountId: String(body.prodAccountId ?? '') || String(body.devAccountId ?? ''),
      githubOrgRepo: String(body.githubOrgRepo ?? ''),
      githubBranch: String(body.githubBranch ?? 'main'),
      oidcRoleArn: body.devAccountId
        ? `arn:aws:iam::${body.devAccountId}:role/github-actions-deployer`
        : 'arn:aws:iam::YOUR_ACCOUNT_ID:role/github-actions-deployer',
      projectType,
      authStrategy,
      tenantIsolation: (body.tenantIsolation as 'single-table' | 'separate-tables') ?? 'single-table',
      enableMultiTenancy: projectType === 'cms',
      hasKmsAuth: authStrategy === 'cognito-kms',
      hasCognito: authStrategy === 'cognito-kms' || authStrategy === 'cognito',
      hasCloudFront: projectType === 'cms' || projectType === 'api',
      generateStaging: Boolean(body.generateStaging),
      editorDomain: String(body.editorDomain ?? ''),
      expectedTenantCount: (body.expectedTenantCount as '<75' | '75+') ?? '<75',
    };

    const templates = getTemplates(vars);

    reply.raw.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${projectName}.zip"`,
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(reply.raw);

    for (const t of templates) {
      const content = render(t.template, vars);
      archive.append(content, { name: `${projectName}/${t.outputPath}` });
    }

    await archive.finalize();
  });
};
