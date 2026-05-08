export default `import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
// {{#if HAS_KMS_AUTH}}
import { verifyEditorToken } from '../auth/kms-jwt.js';
// {{/if HAS_KMS_AUTH}}
// {{#if HAS_COGNITO}}
import { verifyCognitoAccessToken } from '../auth/cognito.js';
// {{/if HAS_COGNITO}}
// {{#if ENABLE_MULTI_TENANCY}}
import { withTenant, EntryNotFoundError, EntryAlreadyExistsError } from '../multitenancy/with-tenant.js';
// {{/if ENABLE_MULTI_TENANCY}}

/**
 * Editor API Lambda.
 *
 * Routes:
 *   GET    /health                   open
 *   GET    /me                       Cognito authorizer (API Gateway)
 *   POST   /editor/site-token        Cognito authorizer (API Gateway)
 *   GET    /content/:slug            in-handler auth (Cognito OR overlay JWT)
 *   PUT    /content/:slug            in-handler auth (Cognito OR overlay JWT)
 *   DELETE /content/:slug            in-handler auth (Cognito OR overlay JWT)
 *   POST   /content/:slug/publish    in-handler auth (Cognito OR overlay JWT)
 *
 * /content/* uses in-handler verification because it must accept BOTH Cognito
 * access tokens (SPA writes) and KMS-signed overlay JWTs (inline editor writes).
 * API Gateway's built-in JWT authorizer supports only one issuer.
 *
 * Tenant isolation: every authenticated route validates that
 * X-{{PROJECT_NAME_UPPER}}-Tenant ∈ authCtx.tenants BEFORE accessing DynamoDB.
 * withTenant() then prepends TENANT#<id> to every key.
 */

type Event = APIGatewayProxyEventV2WithJWTAuthorizer;
type Result = APIGatewayProxyStructuredResultV2;

interface AuthContext {
  sub: string;
  tenants: string[];
  role: string;
  email?: string;
  source: 'cognito' | 'overlay';
}

export const handler = async (event: Event): Promise<Result> => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    if (method === 'GET' && path === '/health') return ok({ status: 'ok' });

    const authCtx = await getAuthContext(event);
    if (!authCtx) return error(401, 'unauthorized');

    if (method === 'GET' && path === '/me') {
      return ok({ sub: authCtx.sub, email: authCtx.email, tenants: authCtx.tenants, role: authCtx.role });
    }

    if (method === 'POST' && path === '/editor/site-token') {
      if (authCtx.source !== 'cognito') return error(403, 'cognito_required');
      return handleSiteToken(authCtx, event);
    }

    // {{#if ENABLE_MULTI_TENANCY}}
    const tenantId = event.headers['x-{{PROJECT_NAME}}-tenant'];
    if (!tenantId) return error(400, 'missing X-{{PROJECT_NAME_UPPER}}-Tenant header');
    if (!authCtx.tenants.includes(tenantId)) return error(403, 'tenant_forbidden');

    const publishMatch = path.match(/^\\/content\\/(.+)\\/publish$/);
    if (publishMatch && method === 'POST') {
      return handlePublish(tenantId, decodeURIComponent(publishMatch[1]!));
    }

    const slugMatch = path.match(/^\\/content\\/(.+)$/);
    if (slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]!);
      if (method === 'GET') return handleGetContent(tenantId, slug);
      if (method === 'PUT') return handlePutContent(tenantId, slug, event);
      if (method === 'DELETE') return handleDeleteContent(tenantId, slug);
    }
    // {{/if ENABLE_MULTI_TENANCY}}

    return error(404, \`route not found: \${method} \${path}\`);
  } catch (e) {
    console.error('handler error', e);
    return error(500, (e as Error).message);
  }
};

// --- Auth -------------------------------------------------------------------

async function getAuthContext(event: Event): Promise<AuthContext | null> {
  // 1) Pre-verified Cognito claims injected by API Gateway authorizer.
  const claims = event.requestContext.authorizer?.jwt?.claims;
  if (claims) {
    return {
      sub: String(claims.sub ?? ''),
      tenants: parseTenantsClaim(claims.tenants),
      role: typeof claims.role === 'string' ? claims.role : 'editor',
      email: typeof claims.email === 'string' ? claims.email : undefined,
      source: 'cognito',
    };
  }

  const auth = event.headers.authorization ?? event.headers.Authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  if (!token) return null;

  // {{#if HAS_KMS_AUTH}}
  // 2) KMS-signed overlay JWT — try first (type claim check, one KMS:Verify call).
  const overlay = await verifyEditorToken(token);
  if (overlay && overlay.type === 'overlay') {
    return {
      sub: overlay.sub,
      tenants: [overlay.tenant],
      role: 'editor',
      source: 'overlay',
    };
  }
  // {{/if HAS_KMS_AUTH}}

  // {{#if HAS_COGNITO}}
  // 3) Cognito access token (cached JWKS verification via aws-jwt-verify).
  const cognito = await verifyCognitoAccessToken(token);
  if (cognito) {
    return {
      sub: cognito.sub,
      tenants: parseTenantsClaim((cognito as Record<string, unknown>).tenants),
      role:
        typeof (cognito as Record<string, unknown>).role === 'string'
          ? String((cognito as Record<string, unknown>).role)
          : 'editor',
      email:
        typeof (cognito as Record<string, unknown>).email === 'string'
          ? String((cognito as Record<string, unknown>).email)
          : undefined,
      source: 'cognito',
    };
  }
  // {{/if HAS_COGNITO}}

  return null;
}

// --- Route handlers ---------------------------------------------------------

async function handleSiteToken(ctx: AuthContext, event: Event): Promise<Result> {
  const body = parseJsonBody(event);
  if (!body) return error(400, 'invalid_json');
  const tenant = String(body.tenant ?? '');
  const slug = String(body.slug ?? '');
  if (!tenant || !slug) return error(400, 'tenant and slug required');
  if (!ctx.tenants.includes(tenant)) return error(403, 'tenant_forbidden');

  // {{#if HAS_KMS_AUTH}}
  const { signSiteEditToken } = await import('./auth/kms-jwt.js');
  const token = await signSiteEditToken({ sub: ctx.sub, tenant, slug });
  return ok({ token, slug, expiresInSeconds: 300 });
  // {{/if HAS_KMS_AUTH}}
  return error(501, 'auth not configured');
}

// {{#if ENABLE_MULTI_TENANCY}}
async function handleGetContent(tenantId: string, slug: string): Promise<Result> {
  try {
    const item = await withTenant(tenantId, (t) => t.get('pages', slug));
    return ok(item);
  } catch (e) {
    if (e instanceof EntryNotFoundError) return error(404, 'not_found');
    throw e;
  }
}

async function handlePutContent(tenantId: string, slug: string, event: Event): Promise<Result> {
  const body = parseJsonBody(event);
  if (!body) return error(400, 'invalid_json');
  const collection = String(body.collection ?? 'pages');
  const data = body.data as Record<string, unknown> | undefined;
  const patch = body.patch as Record<string, unknown> | undefined;

  try {
    if (data !== undefined) {
      try {
        await withTenant(tenantId, (t) => t.create(collection, slug, data));
      } catch (e) {
        if (e instanceof EntryAlreadyExistsError) {
          await withTenant(tenantId, (t) => t.update(collection, slug, data));
        } else {
          throw e;
        }
      }
    } else if (patch !== undefined) {
      await withTenant(tenantId, (t) => t.update(collection, slug, patch));
    } else {
      return error(400, 'expected \`data\` or \`patch\` in body');
    }
    return noContent();
  } catch (e) {
    if (e instanceof EntryNotFoundError) return error(404, 'not_found');
    throw e;
  }
}

async function handleDeleteContent(tenantId: string, slug: string): Promise<Result> {
  try {
    await withTenant(tenantId, (t) => t.remove('pages', slug));
    return noContent();
  } catch (e) {
    if (e instanceof EntryNotFoundError) return error(404, 'not_found');
    throw e;
  }
}

async function handlePublish(tenantId: string, slug: string): Promise<Result> {
  try {
    await withTenant(tenantId, (t) =>
      t.update('pages', slug, { status: 'published', published_at: new Date().toISOString() }),
    );
  } catch (e) {
    if (e instanceof EntryNotFoundError) return error(404, 'not_found');
    throw e;
  }

  const distId = process.env.{{PROJECT_NAME_UPPER}}_WEB_DISTRIBUTION_ID;
  if (distId) {
    const paths = slug === 'index' ? ['/'] : [\`/\${slug}\`, '/'];
    await invalidateCloudFront(distId, paths);
    return ok({ status: 'published', invalidated: paths });
  }
  return ok({ status: 'published', invalidated: [] });
}

let _cf: CloudFrontClient | null = null;
function getCloudFront(): CloudFrontClient {
  if (!_cf) _cf = new CloudFrontClient({ region: 'us-east-1' });
  return _cf;
}

async function invalidateCloudFront(distributionId: string, paths: string[]): Promise<void> {
  await getCloudFront().send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: \`{{PROJECT_NAME}}-\${Date.now()}\`,
        Paths: { Quantity: paths.length, Items: paths },
      },
    }),
  );
}
// {{/if ENABLE_MULTI_TENANCY}}

// --- Helpers ----------------------------------------------------------------

function ok(body: unknown): Result {
  return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(body) };
}

function noContent(): Result {
  return { statusCode: 204, headers: corsHeaders() };
}

function error(statusCode: number, message: string): Result {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify({ error: message }) };
}

function corsHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'true',
  };
}

function parseJsonBody(event: Event): Record<string, unknown> | null {
  if (!event.body) return null;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseTenantsClaim(claim: unknown): string[] {
  if (Array.isArray(claim)) return claim.filter((s): s is string => typeof s === 'string');
  if (typeof claim === 'string') {
    if (claim.startsWith('[')) {
      try {
        const parsed = JSON.parse(claim);
        return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
      } catch {
        return [];
      }
    }
    return claim.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
`;
