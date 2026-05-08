import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { IAMClient, ListOpenIDConnectProvidersCommand, GetRoleCommand } from '@aws-sdk/client-iam';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
export interface CallerIdentity {
  accountId: string;
  userId: string;
  arn: string;
}

export interface RoleSummary {
  arn: string;
  trustPolicy: string;
}

function credentials(profile?: string): ReturnType<typeof fromIni> | undefined {
  return profile ? fromIni({ profile }) : undefined;
}

export async function getCallerIdentity(
  profile?: string,
): Promise<CallerIdentity | null> {
  try {
    const client = new STSClient({ credentials: credentials(profile) });
    const out = await client.send(new GetCallerIdentityCommand({}));
    return {
      accountId: out.Account ?? '',
      userId: out.UserId ?? '',
      arn: out.Arn ?? '',
    };
  } catch {
    return null;
  }
}

export async function findOidcProvider(
  issuerUrl: string,
  profile?: string,
): Promise<string | null> {
  try {
    const client = new IAMClient({ credentials: credentials(profile) });
    const out = await client.send(new ListOpenIDConnectProvidersCommand({}));
    const providers = out.OpenIDConnectProviderList ?? [];
    // ARN format: arn:aws:iam::<account>:oidc-provider/<host>
    const found = providers.find((p) => p.Arn?.includes(new URL(issuerUrl).host));
    return found?.Arn ?? null;
  } catch {
    return null;
  }
}

export async function getIamRole(
  roleName: string,
  profile?: string,
): Promise<RoleSummary | null> {
  try {
    const client = new IAMClient({ credentials: credentials(profile) });
    const out = await client.send(new GetRoleCommand({ RoleName: roleName }));
    const role = out.Role;
    if (!role?.Arn) return null;
    const trustPolicy = role.AssumeRolePolicyDocument
      ? decodeURIComponent(role.AssumeRolePolicyDocument)
      : '';
    return { arn: role.Arn, trustPolicy };
  } catch {
    return null;
  }
}

export async function listBucketsWithPrefix(
  prefix: string,
  profile?: string,
): Promise<string[]> {
  try {
    const client = new S3Client({ credentials: credentials(profile) });
    const out = await client.send(new ListBucketsCommand({}));
    return (out.Buckets ?? [])
      .map((b) => b.Name ?? '')
      .filter((name) => name.startsWith(prefix));
  } catch {
    return [];
  }
}
