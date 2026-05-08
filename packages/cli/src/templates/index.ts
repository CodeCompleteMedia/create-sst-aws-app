import type { TemplateVars } from '../types.js';

// Workspace
import rootPackageJson from './workspace/root-package-json.js';
import pnpmWorkspace from './workspace/pnpm-workspace.js';
import tsconfigBase from './workspace/tsconfig-base.js';
import biomeConfig from './workspace/biome.js';
import npmrc from './workspace/npmrc.js';
import gitignore from './workspace/gitignore.js';

// Infrastructure
import sstConfig from './sst/sst-config.js';
import infraPackageJson from './infra/package-json.js';
import infraTsconfig from './infra/tsconfig.js';

// Server package
import serverPackageJson from './server/package-json.js';
import serverTsconfig from './server/tsconfig.js';

// Auth
import kmsJwt from './auth/kms-jwt.js';
import cognito from './auth/cognito.js';

// API handler
import apiHandler from './api/handler.js';

// Multi-tenancy
import withTenant from './multitenancy/with-tenant.js';

// SSR
import tenantResolver from './ssr/tenant-resolver.js';

// CI/CD
import deployWorkflow from './github/deploy-workflow.js';

export interface TemplateEntry {
  outputPath: string;
  template: string;
  condition?: (vars: TemplateVars) => boolean;
}

export function getTemplates(vars: TemplateVars): TemplateEntry[] {
  const all: TemplateEntry[] = [
    // Workspace root
    { outputPath: 'package.json', template: rootPackageJson },
    { outputPath: 'pnpm-workspace.yaml', template: pnpmWorkspace },
    { outputPath: 'tsconfig.base.json', template: tsconfigBase },
    { outputPath: 'biome.json', template: biomeConfig },
    { outputPath: '.npmrc', template: npmrc },
    { outputPath: '.gitignore', template: gitignore },

    // Infrastructure (SST)
    { outputPath: 'packages/infra/package.json', template: infraPackageJson },
    { outputPath: 'packages/infra/tsconfig.json', template: infraTsconfig },
    { outputPath: 'packages/infra/sst.config.ts', template: sstConfig },

    // Server package
    { outputPath: 'packages/server/package.json', template: serverPackageJson },
    { outputPath: 'packages/server/tsconfig.json', template: serverTsconfig },

    // Auth
    {
      outputPath: 'packages/server/src/auth/kms-jwt.ts',
      template: kmsJwt,
      condition: (v) => v.hasKmsAuth,
    },
    {
      outputPath: 'packages/server/src/auth/cognito.ts',
      template: cognito,
      condition: (v) => v.hasCognito,
    },

    // API handler
    {
      outputPath: 'packages/server/src/api/handler.ts',
      template: apiHandler,
      condition: (v) => v.hasCognito,
    },

    // Multi-tenancy
    {
      outputPath: 'packages/server/src/multitenancy/with-tenant.ts',
      template: withTenant,
      condition: (v) => v.enableMultiTenancy,
    },

    // SSR
    {
      outputPath: 'packages/server/src/ssr/tenant-resolver.ts',
      template: tenantResolver,
      condition: (v) => v.enableMultiTenancy,
    },

    // GitHub Actions
    {
      outputPath: '.github/workflows/deploy.yml',
      template: deployWorkflow,
      condition: (v) => v.githubOrgRepo !== '',
    },
  ];

  return all.filter((t) => !t.condition || t.condition(vars));
}
