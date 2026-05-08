export type ProjectType = 'cms' | 'api' | 'static';
export type AuthStrategy = 'cognito-kms' | 'cognito' | 'none';
export type TenantIsolation = 'single-table' | 'separate-tables';

export interface TemplateVars {
  projectName: string;
  projectNameUpper: string;
  awsRegion: string;
  devAccountId: string;
  prodAccountId: string;
  githubOrgRepo: string;
  githubBranch: string;
  oidcRoleArn: string;
  projectType: ProjectType;
  authStrategy: AuthStrategy;
  tenantIsolation: TenantIsolation;
  enableMultiTenancy: boolean;
  hasKmsAuth: boolean;
  hasCognito: boolean;
  hasCloudFront: boolean;
  generateStaging: boolean;
  editorDomain: string;
  expectedTenantCount: '<75' | '75+';
}

export interface GeneratedFile {
  outputPath: string;
  content: string;
}
