export default `import { withTenant } from '../multitenancy/with-tenant.js';

/**
 * Resolve a tenant ID from the incoming Host header.
 *
 * In production, tenant domains are registered in DynamoDB with:
 *   pk: TENANT#<id>
 *   sk: CONFIG
 *   gsi1pk: HOST#<domain>   ← enables this lookup
 *   gsi1sk: TENANT#<id>
 *
 * A module-level cache (warmed across Lambda invocations) avoids a DDB call
 * on every request. TTL of 5 minutes balances freshness with cost. Domain
 * changes take effect within one cache window.
 */

interface CacheEntry {
  tenantId: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveTenantId(host: string): Promise<string | null> {
  const normalizedHost = host.toLowerCase().split(':')[0] ?? host;

  // Module-scope cache — persists across warm Lambda invocations.
  const cached = cache.get(normalizedHost);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenantId;
  }

  // Default tenant for local dev and the primary domain.
  const defaultTenantId = process.env.{{PROJECT_NAME_UPPER}}_DEFAULT_TENANT_ID;
  if (!defaultTenantId) throw new Error('missing {{PROJECT_NAME_UPPER}}_DEFAULT_TENANT_ID');

  // TODO: implement GSI1 query once tenant domains are registered in DynamoDB.
  // For now, all requests resolve to the default tenant.
  // Pattern:
  //   const result = await withTenant(defaultTenantId, async (t) => {
  //     return t.list('hosts', { filter: { gsi1pk: \`HOST#\${normalizedHost}\` } });
  //   });
  //   const tenantId = result[0]?.id as string | undefined;
  const tenantId = defaultTenantId;

  cache.set(normalizedHost, { tenantId, expiresAt: Date.now() + CACHE_TTL_MS });
  return tenantId;
}

export { withTenant };
`;
