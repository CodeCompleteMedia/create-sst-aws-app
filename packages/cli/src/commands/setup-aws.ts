import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { deployerRoleInlinePolicy, oidcTrustPolicy } from '../aws/iam-docs.js';
import {
  findOidcProvider,
  getCallerIdentity,
  getIamRole,
  listBucketsWithPrefix,
} from '../aws/probe.js';
import {
  bold,
  cyan,
  dim,
  fail,
  header,
  info,
  instruction,
  pass,
  red,
  warn,
} from '../wizard/printer.js';

export interface SetupAwsOptions {
  profile?: string;
  projectName?: string;
  githubOrgRepo?: string;
  githubBranch?: string;
}

export async function runSetupAws(opts: SetupAwsOptions): Promise<void> {
  const profile = opts.profile;
  const projectName = opts.projectName ?? 'my-project';
  const githubOrgRepo = opts.githubOrgRepo ?? 'your-org/your-repo';
  const githubBranch = opts.githubBranch ?? 'main';

  console.log(`\n${bold(cyan('create-sst-aws-app setup-aws'))}`);
  console.log(dim(`Checking AWS prerequisites for ${projectName}...\n`));

  // Step 1 — AWS CLI
  header('Step 1 — AWS CLI');
  const cliVersion = getAwsCliVersion();
  if (cliVersion) {
    pass('AWS CLI installed', cliVersion);
  } else {
    fail('AWS CLI not found');
    instruction(
      'Install AWS CLI',
      'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html',
    );
    console.log(red('  Cannot continue without AWS CLI. Install it and re-run.\n'));
    process.exit(1);
  }

  // Step 2 — Credentials
  header('Step 2 — AWS credentials');
  const identity = await getCallerIdentity(profile);
  if (identity) {
    pass('Credentials working');
    info(`Account: ${identity.accountId}`);
    info(`ARN:     ${identity.arn}`);
  } else {
    fail('No working AWS credentials found');
    instruction(
      'Configure credentials',
      profile
        ? `Add profile [${profile}] to ~/.aws/credentials\nor run: aws configure --profile ${profile}`
        : 'Run: aws configure\nor set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
    );
    process.exit(1);
  }

  // Free Tier org warning — post-July 2025: standalone accounts first
  warn('Free Tier note');
  info('Post-July 2025: accounts that join AWS Organizations immediately lose Free Tier.');
  info('Stay standalone during initial deploy (~$20-40). Join org after the first week.');
  console.log();

  // Step 3 — Named profile
  header('Step 3 — Named AWS profile for local dev');
  const expectedProfile = `${projectName}-dev`;
  const hasProfile = await awsProfileExists(expectedProfile);
  if (hasProfile) {
    pass(`Profile [${expectedProfile}] found in ~/.aws/credentials`);
  } else {
    fail(`Profile [${expectedProfile}] not found`);
    instruction(
      `Create IAM user and profile [${expectedProfile}]`,
      [
        '1. Create an IAM user in the AWS console:',
        '   IAM → Users → Create user → name: <your-name>-dev',
        '   Permissions: attach inline policy (JSON below)',
        '',
        '2. Create access keys: IAM → Users → <user> → Security credentials → Access keys',
        '',
        '3. Add to ~/.aws/credentials:',
        `   [${expectedProfile}]`,
        '   aws_access_key_id = <your-key>',
        '   aws_secret_access_key = <your-secret>',
        '',
        '   Inline policy JSON:',
        JSON.stringify(localDevUserPolicyDoc(projectName), null, 2)
          .split('\n')
          .map((l) => `   ${l}`)
          .join('\n'),
      ].join('\n'),
    );
  }

  // Step 4 — GitHub OIDC provider
  header('Step 4 — GitHub Actions OIDC provider');
  const oidcIssuer = 'https://token.actions.githubusercontent.com';
  const oidcArn = await findOidcProvider(oidcIssuer, profile);
  if (oidcArn) {
    pass('OIDC provider found', oidcArn);
  } else {
    fail('GitHub OIDC provider not configured');
    instruction(
      'Create the GitHub Actions OIDC identity provider',
      [
        'AWS Console: IAM → Identity providers → Add provider',
        '',
        '  Provider type: OpenID Connect',
        '  Provider URL:  https://token.actions.githubusercontent.com',
        '  Audience:      sts.amazonaws.com',
        '',
        'Or via CLI (one-time):',
        '  aws iam create-open-id-connect-provider \\',
        '    --url https://token.actions.githubusercontent.com \\',
        '    --client-id-list sts.amazonaws.com \\',
        '    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1',
      ].join('\n'),
    );
  }

  // Step 5 — Deployer IAM role
  const roleName = 'github-actions-deployer';
  header(`Step 5 — IAM role: ${roleName}`);
  const role = await getIamRole(roleName, profile);
  if (role) {
    pass(`Role ${roleName} exists`, role.arn);
    const trustPolicy = JSON.parse(role.trustPolicy) as Record<string, unknown>;
    const stmt = (trustPolicy.Statement as Array<Record<string, unknown>>)[0];
    const condition = stmt?.Condition as Record<string, Record<string, string>> | undefined;
    const subCondition = condition?.StringLike?.['token.actions.githubusercontent.com:sub'] ?? '';
    if (subCondition.includes(githubOrgRepo)) {
      pass(`Trust policy scoped to ${githubOrgRepo}`);
    } else {
      warn(`Trust policy sub condition: ${subCondition}`);
      info(`Expected it to reference ${githubOrgRepo}. Verify the trust policy is correct.`);
    }
  } else {
    fail(`Role ${roleName} not found`);
    instruction(
      `Create IAM role: ${roleName}`,
      [
        'AWS Console: IAM → Roles → Create role',
        '  Trusted entity: Web identity',
        '  Identity provider: token.actions.githubusercontent.com',
        '  Audience: sts.amazonaws.com',
        '',
        'Paste this trust policy (customized for your repo):',
        JSON.stringify(oidcTrustPolicy(identity.accountId, githubOrgRepo, githubBranch), null, 2)
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n'),
        '',
        'Then attach this inline policy:',
        JSON.stringify(deployerRoleInlinePolicy(identity.accountId, projectName), null, 2)
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n'),
      ].join('\n'),
    );
  }

  // Step 6 — SST bootstrap bucket
  header('Step 6 — SST bootstrap bucket');
  const sstBuckets = await listBucketsWithPrefix('sst-asset-', profile);
  if (sstBuckets.length > 0) {
    pass('SST bootstrap bucket found', sstBuckets[0]);
  } else {
    fail('SST bootstrap bucket not found');
    instruction('Bootstrap SST', `cd ${projectName}\npnpm sst bootstrap --stage dev`);
  }

  // Step 7 — ACM region reminder
  header('Step 7 — ACM certificate region (CloudFront)');
  warn('CloudFront certificates MUST be in us-east-1, even if your app is in another region');
  info('Your primary region: us-west-2');
  info('The generated sst.config.ts handles this with an explicit us-east-1 ACM provider.');
  info('No action needed — this is just a reminder for when you wire custom domains.');

  // Summary
  console.log(`\n${bold('─'.repeat(60))}`);
  console.log(bold('Re-run this command after completing any failing steps above.'));
  console.log(dim('All checks pass → you are ready to run: pnpm sst deploy --stage dev\n'));
}

function getAwsCliVersion(): string | null {
  try {
    const out = execSync('aws --version 2>&1', { encoding: 'utf8' });
    const match = out.match(/aws-cli\/([\d.]+)/);
    return match ? `v${match[1]}` : (out.trim().split('\n')[0] ?? null);
  } catch {
    return null;
  }
}

async function awsProfileExists(profile: string): Promise<boolean> {
  try {
    const credPath = join(homedir(), '.aws', 'credentials');
    const content = await readFile(credPath, 'utf8');
    return content.includes(`[${profile}]`);
  } catch {
    return false;
  }
}

function localDevUserPolicyDoc(projectName: string): object {
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'cloudformation:*',
          'lambda:*',
          'dynamodb:*',
          's3:*',
          'cognito-idp:*',
          'kms:*',
          'cloudfront:*',
          'acm:*',
          'apigateway:*',
          'logs:*',
          'iam:*',
          'sts:GetCallerIdentity',
        ],
        Resource: '*',
      },
    ],
  };
}
