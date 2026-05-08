import type { TemplateVars } from '../types.js';

type VarMap = Record<string, string | boolean>;

export function render(template: string, vars: TemplateVars): string {
  const map = buildMap(vars);
  let out = processConditionals(template, map);
  out = substituteVars(out, map);
  return out;
}

function buildMap(vars: TemplateVars): VarMap {
  return {
    PROJECT_NAME: vars.projectName,
    PROJECT_NAME_UPPER: vars.projectNameUpper,
    AWS_REGION: vars.awsRegion,
    DEV_ACCOUNT_ID: vars.devAccountId,
    PROD_ACCOUNT_ID: vars.prodAccountId,
    GITHUB_ORG_REPO: vars.githubOrgRepo,
    GITHUB_BRANCH: vars.githubBranch,
    OIDC_ROLE_ARN: vars.oidcRoleArn,
    PROJECT_TYPE: vars.projectType,
    AUTH_STRATEGY: vars.authStrategy,
    EDITOR_DOMAIN: vars.editorDomain,
    ENABLE_MULTI_TENANCY: vars.enableMultiTenancy,
    HAS_KMS_AUTH: vars.hasKmsAuth,
    HAS_COGNITO: vars.hasCognito,
    HAS_CLOUD_FRONT: vars.hasCloudFront,
    GENERATE_STAGING: vars.generateStaging,
    EXPECTED_TENANT_COUNT: vars.expectedTenantCount,
  };
}

function processConditionals(template: string, map: VarMap): string {
  // Matches: // {{#if VAR}} ... // {{/if VAR}}  or  # {{#if VAR}} ... # {{/if VAR}}
  const blockRe = /(?:\/\/|#) \{\{#if (\w+)\}\}\n([\s\S]*?)(?:\/\/|#) \{\{\/if \1\}\}\n?/g;

  return template.replace(blockRe, (_match, varName: string, body: string) => {
    const value = map[varName];
    if (!value) return '';
    // Remove the leading line-comment markers from each line of the kept body.
    return body;
  });
}

function substituteVars(template: string, map: VarMap): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = map[key];
    if (value === undefined) return `{{${key}}}`;
    return String(value);
  });
}
