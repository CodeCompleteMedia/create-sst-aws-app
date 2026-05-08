import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeFiles } from '../renderer/file-writer.js';
import { render } from '../renderer/template-engine.js';
import { getTemplates } from '../templates/index.js';
import type { AuthStrategy, ProjectType, TemplateVars, TenantIsolation } from '../types.js';
import { buildVars, slugify } from '../vars.js';
import { bold, cyan, dim, green, header } from '../wizard/printer.js';
import { ask } from '../wizard/prompt.js';

export interface InitOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export async function runInit(rawName: string, opts: InitOptions): Promise<void> {
  const initialName = slugify(rawName) || 'my-app';

  console.log(`\n${bold(cyan('create-sst-aws-app'))}`);
  console.log(dim('Scaffolding an SST v3 project with production-grade AWS patterns\n'));

  const vars = opts.yes ? defaultVars(initialName) : await runWizard(initialName);
  const projectName = vars.projectName;

  const dest = resolve(process.cwd(), projectName);
  if (existsSync(dest) && !opts.dryRun) {
    console.log(`\n  Directory ${bold(projectName)} already exists.`);
    const { overwrite } = await ask({ type: 'confirm', name: 'overwrite', message: 'Overwrite?' });
    if (!overwrite) process.exit(1);
  }

  header('Generating files');
  if (opts.dryRun) console.log(dim('  (dry run — no files written)\n'));

  const templates = getTemplates(vars);
  const files = templates.map((t) => ({
    outputPath: t.outputPath,
    content: render(t.template, vars),
  }));

  await writeFiles(dest, files, { dryRun: opts.dryRun });

  if (!opts.dryRun) {
    printNextSteps(projectName, vars);
  }
}

async function runWizard(projectName: string): Promise<TemplateVars> {
  // Phase 1 — Project identity
  header('Project identity');
  const phase1 = await ask([
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name (slug)',
      initial: projectName,
      validate: (v: string) => /^[a-z0-9-]+$/.test(v) || 'Lowercase letters, numbers, hyphens only',
    },
    {
      type: 'select',
      name: 'awsRegion',
      message: 'Primary AWS region',
      choices: [
        { title: 'us-west-2  (Oregon — recommended)', value: 'us-west-2' },
        { title: 'us-east-1  (N. Virginia)', value: 'us-east-1' },
        { title: 'eu-west-1  (Ireland)', value: 'eu-west-1' },
        { title: 'ap-southeast-1  (Singapore)', value: 'ap-southeast-1' },
      ],
      initial: 0,
    },
    {
      type: 'select',
      name: 'projectType',
      message: 'Project type',
      choices: [
        { title: 'Multi-tenant CMS (like ccms)', value: 'cms' },
        { title: 'Single-tenant web app', value: 'api' },
        { title: 'API-only (no SSR)', value: 'static' },
      ],
      initial: 0,
    },
  ]);

  const finalName = slugify(String(phase1.projectName ?? projectName));

  // Phase 2 — Auth
  header('Authentication');
  const phase2 = await ask([
    {
      type: 'select',
      name: 'authStrategy',
      message: 'Authentication strategy',
      choices: [
        { title: 'Cognito + KMS hybrid JWT  (SPA + inline editor)', value: 'cognito-kms' },
        { title: 'Cognito only  (SPA auth)', value: 'cognito' },
        { title: 'None', value: 'none' },
      ],
      initial: 0,
    },
    {
      type: 'text',
      name: 'editorDomain',
      message: 'Editor domain (optional, e.g. cms.your-agency.com — skip to configure later)',
      initial: '',
    },
  ]);

  // Phase 3 — Multi-tenancy (CMS projects)
  let tenantChoices: Record<string, unknown> = {
    tenantIsolation: 'single-table',
    expectedTenantCount: '<75',
  };
  if (phase1.projectType === 'cms') {
    header('Multi-tenancy');
    tenantChoices = await ask([
      {
        type: 'select',
        name: 'tenantIsolation',
        message: 'Tenant isolation model',
        choices: [
          {
            title: 'Single-table DynamoDB  (pk: TENANT#<id>) — recommended',
            value: 'single-table',
          },
          { title: 'Separate tables per tenant', value: 'separate-tables' },
        ],
        initial: 0,
      },
      {
        type: 'select',
        name: 'expectedTenantCount',
        message: 'Expected tenant count (affects CloudFront cert strategy)',
        choices: [
          { title: 'Fewer than 75  (shared distribution + SAN cert)', value: '<75' },
          { title: '75+  (plan for multiple distributions)', value: '75+' },
        ],
        initial: 0,
      },
    ]);

    if (tenantChoices.expectedTenantCount === '75+') {
      console.log(
        dim('\n  Note: 75+ tenants exceeds CloudFront SAN cert limits per distribution.') +
          dim(
            '\n  The generated config handles <75. You will need to shard by distribution at scale.\n',
          ),
      );
    }
  }

  // Phase 4 — CI/CD
  header('CI/CD');
  const phase4 = await ask([
    {
      type: 'text',
      name: 'githubOrgRepo',
      message: 'GitHub repository (org/repo)',
      initial: '',
      validate: (v: string) => !v || /^[\w.-]+\/[\w.-]+$/.test(v) || 'Format: org/repo',
    },
    {
      type: 'text',
      name: 'githubBranch',
      message: 'Production branch',
      initial: 'main',
    },
    {
      type: 'text',
      name: 'devAccountId',
      message: 'Dev AWS account ID (12 digits)',
      initial: '',
      validate: (v: string) => !v || /^\d{12}$/.test(v) || '12-digit account ID',
    },
    {
      type: 'text',
      name: 'prodAccountId',
      message: 'Prod AWS account ID (leave blank to use same as dev)',
      initial: '',
      validate: (v: string) => !v || /^\d{12}$/.test(v) || '12-digit account ID',
    },
  ]);

  // Phase 5 — Staging
  header('Staging');
  const phase5 = await ask({
    type: 'confirm',
    name: 'generateStaging',
    message: 'Generate a staging environment in the workflow?',
    initial: true,
  });

  const devAccountId = String(phase4.devAccountId ?? '');
  const prodAccountId = String(phase4.prodAccountId ?? '') || devAccountId;
  const authStrategy = String(phase2.authStrategy ?? 'cognito-kms') as AuthStrategy;

  return buildVars({
    projectName: finalName,
    awsRegion: String(phase1.awsRegion ?? 'us-west-2'),
    projectType: String(phase1.projectType ?? 'cms') as ProjectType,
    authStrategy,
    editorDomain: String(phase2.editorDomain ?? ''),
    tenantIsolation: String(tenantChoices.tenantIsolation ?? 'single-table') as TenantIsolation,
    expectedTenantCount: String(tenantChoices.expectedTenantCount ?? '<75') as '<75' | '75+',
    githubOrgRepo: String(phase4.githubOrgRepo ?? ''),
    githubBranch: String(phase4.githubBranch ?? 'main'),
    devAccountId,
    prodAccountId,
    generateStaging: Boolean(phase5.generateStaging ?? true),
  });
}

function defaultVars(projectName: string): TemplateVars {
  return buildVars({
    projectName,
    awsRegion: 'us-west-2',
    projectType: 'cms',
    authStrategy: 'cognito-kms',
    editorDomain: '',
    tenantIsolation: 'single-table',
    expectedTenantCount: '<75',
    githubOrgRepo: '',
    githubBranch: 'main',
    devAccountId: '',
    prodAccountId: '',
    generateStaging: true,
  });
}

function printNextSteps(projectName: string, vars: TemplateVars): void {
  console.log(`\n${bold(green('✓'))} ${bold(`Created ${projectName}/`)}\n`);
  console.log(bold('Next steps:\n'));
  console.log(`  ${dim('1.')} cd ${projectName}`);
  console.log(`  ${dim('2.')} pnpm install`);
  console.log(
    `  ${dim('3.')} npx create-sst-aws-app setup-aws${vars.githubOrgRepo ? ` --project ${projectName} --repo ${vars.githubOrgRepo}` : ''}`,
  );
  console.log(`  ${dim('4.')} pnpm sst deploy --stage dev`);
  if (vars.hasCognito) {
    console.log(
      `  ${dim('5.')} Copy the editor URL from deploy output, set as ${vars.projectNameUpper}_EDITOR_URL`,
    );
    console.log(
      `  ${dim('6.')} pnpm sst deploy --stage dev  (second pass — wires Cognito callback)`,
    );
  }
  console.log();
}
