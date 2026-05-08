import type { AuthStrategy, ProjectType, TemplateVars, TenantIsolation } from './types.js';

export interface RawVars {
  projectName: string;
  awsRegion: string;
  projectType: ProjectType;
  authStrategy: AuthStrategy;
  editorDomain: string;
  tenantIsolation: TenantIsolation;
  expectedTenantCount: '<75' | '75+';
  githubOrgRepo: string;
  githubBranch: string;
  devAccountId: string;
  prodAccountId: string;
  generateStaging: boolean;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildVars(raw: RawVars): TemplateVars {
  const projectName = slugify(raw.projectName) || 'my-project';
  const hasKmsAuth = raw.authStrategy === 'cognito-kms';
  const hasCognito = raw.authStrategy === 'cognito-kms' || raw.authStrategy === 'cognito';
  const enableMultiTenancy = raw.projectType === 'cms';
  const hasCloudFront = raw.projectType === 'cms' || raw.projectType === 'api';
  const oidcRoleArn = raw.devAccountId
    ? `arn:aws:iam::${raw.devAccountId}:role/github-actions-deployer`
    : 'arn:aws:iam::YOUR_ACCOUNT_ID:role/github-actions-deployer';
  const prodAccountId = raw.prodAccountId || raw.devAccountId;

  return {
    projectName,
    projectNameUpper: projectName.toUpperCase().replace(/-/g, '_'),
    awsRegion: raw.awsRegion,
    devAccountId: raw.devAccountId,
    prodAccountId,
    githubOrgRepo: raw.githubOrgRepo,
    githubBranch: raw.githubBranch,
    oidcRoleArn,
    projectType: raw.projectType,
    authStrategy: raw.authStrategy,
    tenantIsolation: raw.tenantIsolation,
    enableMultiTenancy,
    hasKmsAuth,
    hasCognito,
    hasCloudFront,
    generateStaging: raw.generateStaging,
    editorDomain: raw.editorDomain,
    expectedTenantCount: raw.expectedTenantCount,
  };
}

const ALLOWED_PROJECT_TYPES: ReadonlySet<ProjectType> = new Set(['cms', 'api', 'static']);
const ALLOWED_AUTH: ReadonlySet<AuthStrategy> = new Set(['cognito-kms', 'cognito', 'none']);
const ALLOWED_ISOLATION: ReadonlySet<TenantIsolation> = new Set([
  'single-table',
  'separate-tables',
]);
const ALLOWED_TENANT_COUNT: ReadonlySet<'<75' | '75+'> = new Set(['<75', '75+']);
const ACCOUNT_ID_RE = /^\d{12}$/;
const ORG_REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const BRANCH_RE = /^[\w./-]+$/;

function pickEnum<T extends string>(value: unknown, allowed: ReadonlySet<T>, fallback: T): T {
  return typeof value === 'string' && (allowed as ReadonlySet<string>).has(value)
    ? (value as T)
    : fallback;
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function pickAccountId(value: unknown): string {
  const v = pickString(value);
  return ACCOUNT_ID_RE.test(v) ? v : '';
}

function pickOrgRepo(value: unknown): string {
  const v = pickString(value);
  return v === '' || ORG_REPO_RE.test(v) ? v : '';
}

function pickBranch(value: unknown): string {
  const v = pickString(value, 'main');
  return BRANCH_RE.test(v) ? v : 'main';
}

export function rawVarsFromInput(input: Record<string, unknown>): RawVars {
  return {
    projectName: pickString(input.projectName, 'my-project'),
    awsRegion: pickString(input.awsRegion, 'us-west-2'),
    projectType: pickEnum<ProjectType>(input.projectType, ALLOWED_PROJECT_TYPES, 'api'),
    authStrategy: pickEnum<AuthStrategy>(input.authStrategy, ALLOWED_AUTH, 'none'),
    editorDomain: pickString(input.editorDomain),
    tenantIsolation: pickEnum<TenantIsolation>(
      input.tenantIsolation,
      ALLOWED_ISOLATION,
      'single-table',
    ),
    expectedTenantCount: pickEnum<'<75' | '75+'>(
      input.expectedTenantCount,
      ALLOWED_TENANT_COUNT,
      '<75',
    ),
    githubOrgRepo: pickOrgRepo(input.githubOrgRepo),
    githubBranch: pickBranch(input.githubBranch),
    devAccountId: pickAccountId(input.devAccountId),
    prodAccountId: pickAccountId(input.prodAccountId),
    generateStaging: Boolean(input.generateStaging),
  };
}
