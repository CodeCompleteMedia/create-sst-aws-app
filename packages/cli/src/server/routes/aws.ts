import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import type { FastifyPluginAsync } from 'fastify';
import { oidcTrustPolicy } from '../../aws/iam-docs.js';
import {
  findOidcProvider,
  getCallerIdentity,
  getIamRole,
  listBucketsWithPrefix,
} from '../../aws/probe.js';

export const awsCheckRoutes: FastifyPluginAsync = async (app) => {
  app.get('/aws/check', async (req, reply) => {
    const query = req.query as {
      project?: string;
      repo?: string;
      branch?: string;
      profile?: string;
    };
    const { project = 'my-project', repo = '', branch = 'main', profile } = query;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const done = () => {
      reply.raw.write('data: {"done":true}\n\n');
      reply.raw.end();
    };

    // Step 1: AWS CLI
    try {
      const v = execSync('aws --version 2>&1').toString().trim();
      send({ step: 1, title: 'AWS CLI', status: 'pass', description: `AWS CLI installed: ${v}` });
    } catch {
      send({
        step: 1,
        title: 'AWS CLI',
        status: 'fail',
        description: 'AWS CLI not found',
        fix: 'brew install awscli\n# or\ncurl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg" && sudo installer -pkg AWSCLIV2.pkg -target /',
      });
    }

    // Step 2: Credentials
    let accountId = '';
    const identity = await getCallerIdentity(profile);
    if (identity) {
      accountId = identity.accountId;
      send({
        step: 2,
        title: 'AWS Credentials',
        status: 'pass',
        description: `Account: ${accountId} | ARN: ${identity.arn}`,
      });
    } else {
      send({
        step: 2,
        title: 'AWS Credentials',
        status: 'fail',
        description: 'No working AWS credentials found',
        fix: 'aws configure\n# or export AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
      });
      done();
      return;
    }

    // Step 3: Named profile
    try {
      const creds = readFileSync(`${homedir()}/.aws/credentials`, 'utf8');
      const profileName = profile ?? project;
      if (creds.includes(`[${profileName}]`)) {
        send({
          step: 3,
          title: 'Named Profile',
          status: 'pass',
          description: `Profile [${profileName}] found in ~/.aws/credentials`,
        });
      } else {
        send({
          step: 3,
          title: 'Named Profile',
          status: 'warn',
          description: `Profile [${profileName}] not found`,
          fix: `# Add to ~/.aws/credentials:\n[${profileName}]\naws_access_key_id = YOUR_KEY\naws_secret_access_key = YOUR_SECRET\nregion = us-west-2`,
        });
      }
    } catch {
      send({
        step: 3,
        title: 'Named Profile',
        status: 'warn',
        description: 'Could not read ~/.aws/credentials',
        fix: `aws configure --profile ${profile ?? project}`,
      });
    }

    // Step 4: GitHub OIDC provider
    const oidcIssuer = 'https://token.actions.githubusercontent.com';
    const oidcArn = await findOidcProvider(oidcIssuer, profile);
    if (oidcArn) {
      send({
        step: 4,
        title: 'GitHub OIDC Provider',
        status: 'pass',
        description: `OIDC provider found: ${oidcArn}`,
      });
    } else {
      const fix =
        'aws iam create-open-id-connect-provider \\\n  --url https://token.actions.githubusercontent.com \\\n  --client-id-list sts.amazonaws.com \\\n  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1';
      send({
        step: 4,
        title: 'GitHub OIDC Provider',
        status: 'fail',
        description: 'GitHub OIDC provider not configured',
        fix,
      });
    }

    // Step 5: IAM Role
    const role = await getIamRole('github-actions-deployer', profile);
    if (role) {
      const trustDoc = JSON.parse(role.trustPolicy) as Record<string, unknown>;
      const stmt = (trustDoc?.Statement as Array<Record<string, unknown>>)?.[0];
      const condition = stmt?.Condition as Record<string, Record<string, unknown>> | undefined;
      const subCondition = condition?.StringLike?.['token.actions.githubusercontent.com:sub'];
      const subs = Array.isArray(subCondition)
        ? (subCondition as string[])
        : subCondition
          ? [String(subCondition)]
          : [];
      const expectedSub = repo ? `repo:${repo}:ref:refs/heads/${branch}` : null;
      const subOk = !expectedSub || subs.includes(expectedSub);
      if (subOk) {
        send({
          step: 5,
          title: 'IAM Deployer Role',
          status: 'pass',
          description: `Role github-actions-deployer exists${repo ? ` and trust policy includes ${repo}` : ''}`,
        });
      } else {
        send({
          step: 5,
          title: 'IAM Deployer Role',
          status: 'warn',
          description: `Role exists but trust policy may not include repo:${repo}:ref:refs/heads/${branch}`,
          fix: JSON.stringify(oidcTrustPolicy(accountId, repo, branch), null, 2),
        });
      }
    } else {
      const fix = `# Trust policy:\n${JSON.stringify(oidcTrustPolicy(accountId, repo, branch), null, 2)}\n\n# Inline policy: see easy-aws-deploy setup-aws output`;
      send({
        step: 5,
        title: 'IAM Deployer Role',
        status: 'fail',
        description: 'Role github-actions-deployer not found',
        fix,
      });
    }

    // Step 6: SST bootstrap bucket
    const buckets = await listBucketsWithPrefix('sst-asset-', profile);
    if (buckets.length > 0) {
      send({
        step: 6,
        title: 'SST Bootstrap',
        status: 'pass',
        description: `Bootstrap bucket found: ${buckets[0]}`,
      });
    } else {
      send({
        step: 6,
        title: 'SST Bootstrap',
        status: 'fail',
        description: 'SST bootstrap bucket not found',
        fix: 'cd packages/infra\npnpm sst bootstrap --stage dev',
      });
    }

    // Step 7: ACM region note
    send({
      step: 7,
      title: 'ACM Certificate Region',
      status: 'warn',
      description:
        'CloudFront certificates must be issued in us-east-1 regardless of your primary region',
      fix: '# When creating certificates for CloudFront:\naws acm request-certificate --region us-east-1 --domain-name yourdomain.com',
    });

    done();
  });
};
