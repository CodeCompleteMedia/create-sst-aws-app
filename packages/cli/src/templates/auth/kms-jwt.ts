export default `import {
  KMSClient,
  SignCommand,
  VerifyCommand,
} from '@aws-sdk/client-kms';

/**
 * KMS-signed JWTs for the auth bridge.
 *
 * WHY KMS instead of a symmetric JWT secret:
 *   The inline editor runs on the TENANT's domain, not the editor SPA domain.
 *   Cognito can only issue tokens to its registered callback URL.
 *   KMS asymmetric signing lets the SSR Lambda mint tokens the API can verify
 *   without sharing a secret across trust boundaries.
 *
 * Token kinds (all signed with the same RSA_2048 key):
 *
 *   site-edit (5 min) — minted by API on POST /editor/site-token; passed as
 *     ?{{PROJECT_NAME}}-editor=<jwt> to carry the operator's identity to the
 *     tenant domain where the inline editor is activated.
 *
 *   overlay (10 min) — minted by SSR Lambda once per render; embedded in
 *     <meta name="{{PROJECT_NAME}}:editor-token"> for the inline editor to use
 *     as Authorization on /content/* writes.
 *
 *   session (1 hr) — minted by SSR after validating a site-edit token; stored
 *     in a cookie to avoid re-minting on every request.
 *
 * Format: standard JWS (base64url(header).base64url(payload).base64url(sig))
 * for forward-compatibility with API Gateway JWT authorizers and aws-jwt-verify.
 *
 * verifyEitherJwt: the function to use on /content/* routes that accept BOTH
 * Cognito tokens (from the SPA) and KMS-signed overlay tokens (from inline
 * editor saves). API Gateway's built-in JWT authorizer only supports one issuer,
 * so /content/* uses in-handler verification with this function.
 */

const kms = new KMSClient({ region: process.env.AWS_REGION ?? '{{AWS_REGION}}' });
const KEY_ID_ENV = '{{PROJECT_NAME_UPPER}}_EDITOR_JWT_KEY_ID';

export interface SiteEditClaims {
  type: 'site-edit';
  sub: string;
  tenant: string;
  slug: string;
  iat: number;
  exp: number;
}

export interface OverlayClaims {
  type: 'overlay';
  sub: string;
  tenant: string;
  iat: number;
  exp: number;
}

export interface SessionClaims {
  type: 'session';
  sub: string;
  tenant: string;
  iat: number;
  exp: number;
}

export type EditorClaims = SiteEditClaims | OverlayClaims | SessionClaims;

export async function signSiteEditToken(input: {
  sub: string;
  tenant: string;
  slug: string;
  ttlSeconds?: number;
}): Promise<string> {
  return signToken<SiteEditClaims>(
    { type: 'site-edit', sub: input.sub, tenant: input.tenant, slug: input.slug },
    input.ttlSeconds ?? 5 * 60,
  );
}

export async function signOverlayToken(input: {
  sub: string;
  tenant: string;
  ttlSeconds?: number;
}): Promise<string> {
  return signToken<OverlayClaims>(
    { type: 'overlay', sub: input.sub, tenant: input.tenant },
    input.ttlSeconds ?? 10 * 60,
  );
}

export async function signSessionToken(input: {
  sub: string;
  tenant: string;
  ttlSeconds?: number;
}): Promise<string> {
  return signToken<SessionClaims>(
    { type: 'session', sub: input.sub, tenant: input.tenant },
    input.ttlSeconds ?? 60 * 60,
  );
}

export async function verifyEditorToken(token: string): Promise<EditorClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  let claims: EditorClaims;
  try {
    claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as EditorClaims;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < now) return null;
  if (claims.type !== 'site-edit' && claims.type !== 'overlay' && claims.type !== 'session') {
    return null;
  }

  const keyId = required(KEY_ID_ENV);
  const message = \`\${headerB64}.\${payloadB64}\`;

  try {
    const result = await kms.send(
      new VerifyCommand({
        KeyId: keyId,
        Message: Buffer.from(message, 'utf8'),
        MessageType: 'RAW',
        Signature: b64urlDecode(signatureB64),
        SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
      }),
    );
    return result.SignatureValid ? claims : null;
  } catch {
    return null;
  }
}

// --- internals ---------------------------------------------------------------

async function signToken<T extends EditorClaims>(
  partial: Omit<T, 'iat' | 'exp'>,
  ttlSeconds: number,
): Promise<string> {
  const keyId = required(KEY_ID_ENV);
  const now = Math.floor(Date.now() / 1000);
  const claims = { ...partial, iat: now, exp: now + ttlSeconds };
  const header = { alg: 'RS256', typ: 'JWT', kid: keyId };
  const message = \`\${b64urlString(JSON.stringify(header))}.\${b64urlString(JSON.stringify(claims))}\`;

  const result = await kms.send(
    new SignCommand({
      KeyId: keyId,
      Message: Buffer.from(message, 'utf8'),
      MessageType: 'RAW',
      SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
    }),
  );

  if (!result.Signature) throw new Error('KMS Sign returned empty signature');
  return \`\${message}.\${b64urlBytes(result.Signature)}\`;
}

function b64urlString(s: string): string {
  return b64urlBytes(Buffer.from(s, 'utf8'));
}

function b64urlBytes(b: Uint8Array): string {
  return Buffer.from(b)
    .toString('base64')
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(s: string): Buffer {
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(\`missing required env var: \${name}\`);
  return v;
}
`;
