export default `import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * Tenant isolation wrapper for DynamoDB.
 *
 * WHY this wrapper exists:
 *   In a single-table multi-tenant design, every DDB operation MUST prefix the
 *   partition key with TENANT#<id>. Forgetting this on even one call means a
 *   tenant can read or write another tenant's data.
 *
 *   This wrapper is the only place that constructs DDB commands. The Biome lint
 *   rule below prevents any other file from importing the DynamoDB SDK directly,
 *   so the isolation cannot be bypassed by accident.
 *
 * Add to biome.json to enforce:
 *   "linter": {
 *     "rules": {
 *       "correctness": {
 *         "noRestrictedImports": {
 *           "level": "error",
 *           "options": {
 *             "paths": [
 *               { "name": "@aws-sdk/client-dynamodb", "message": "Use withTenant() from multitenancy/with-tenant.ts" },
 *               { "name": "@aws-sdk/lib-dynamodb", "message": "Use withTenant() from multitenancy/with-tenant.ts" }
 *             ]
 *           }
 *         }
 *       }
 *     }
 *   }
 */

// SK encoding per single-table design.
// 'pages' is the primary entity type; all others are collection items.
export function makeSk(collection: string, id: string): string {
  if (collection === 'pages') return \`PAGE#\${id}\`;
  return \`COLLECTION#\${collection}#\${id}\`;
}

export function makeSkPrefix(collection: string): string {
  if (collection === 'pages') return 'PAGE#';
  return \`COLLECTION#\${collection}#\`;
}

export function parseSk(sk: string): { collection: string; id: string } | null {
  if (sk.startsWith('PAGE#')) return { collection: 'pages', id: sk.slice(5) };
  if (sk.startsWith('COLLECTION#')) {
    const rest = sk.slice('COLLECTION#'.length);
    const idx = rest.indexOf('#');
    if (idx < 0) return null;
    return { collection: rest.slice(0, idx), id: rest.slice(idx + 1) };
  }
  return null;
}

export class EntryNotFoundError extends Error {
  constructor(collection: string, id: string) {
    super(\`\${collection}/\${id} not found\`);
    this.name = 'EntryNotFoundError';
  }
}

export class EntryAlreadyExistsError extends Error {
  constructor(collection: string, id: string) {
    super(\`\${collection}/\${id} already exists\`);
    this.name = 'EntryAlreadyExistsError';
  }
}

export class ReadOnlyError extends Error {
  constructor() {
    super('This source is read-only');
    this.name = 'ReadOnlyError';
  }
}

export interface TenantHelpers {
  get(collection: string, id: string): Promise<Record<string, unknown>>;
  list(collection: string, opts?: { limit?: number; offset?: number }): Promise<Record<string, unknown>[]>;
  put(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  create(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  update(collection: string, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
}

const TABLE = process.env.{{PROJECT_NAME_UPPER}}_TABLE_NAME!;

// WHY \`new DynamoDBDocumentClient(ddb)\` instead of \`DynamoDBDocumentClient.from(ddb)\`:
//   Astro's Vite SSR build dropped the DynamoDBDocumentClient class out of the bundle
//   when the only reference was a static method call (.from()), returning undefined at
//   runtime. Using \`new\` forces the bundler to keep the class reachable.
//   The constructor is marked protected in the .d.ts but is public at runtime.
// @ts-expect-error protected ctor in .d.ts; public in JS runtime
const client: DynamoDBDocumentClient = new DynamoDBDocumentClient(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? '{{AWS_REGION}}' }),
);

export async function withTenant<T>(
  tenantId: string,
  fn: (helpers: TenantHelpers) => Promise<T>,
): Promise<T> {
  const pk = \`TENANT#\${tenantId}\`;

  const helpers: TenantHelpers = {
    async get(collection, id) {
      const sk = makeSk(collection, id);
      const out = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
      if (!out.Item) throw new EntryNotFoundError(collection, id);
      return out.Item;
    },

    async list(collection, opts) {
      const out = await client.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':prefix': makeSkPrefix(collection),
          },
        }),
      );
      const all = out.Items ?? [];
      const offset = opts?.offset ?? 0;
      const limit = opts?.limit ?? all.length;
      return all.slice(offset, offset + limit);
    },

    async put(collection, id, data) {
      const sk = makeSk(collection, id);
      await client.send(
        new PutCommand({
          TableName: TABLE,
          Item: { pk, sk, collection, id, data },
        }),
      );
    },

    async create(collection, id, data) {
      const sk = makeSk(collection, id);
      try {
        await client.send(
          new PutCommand({
            TableName: TABLE,
            Item: { pk, sk, collection, id, data },
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        );
      } catch (err) {
        if (isConditionalCheckFailed(err)) throw new EntryAlreadyExistsError(collection, id);
        throw err;
      }
    },

    async update(collection, id, patch) {
      const sk = makeSk(collection, id);
      const current = await client.send(new GetCommand({ TableName: TABLE, Key: { pk, sk } }));
      if (!current.Item) throw new EntryNotFoundError(collection, id);
      const currentData = (current.Item.data as Record<string, unknown>) ?? {};
      await client.send(
        new PutCommand({
          TableName: TABLE,
          Item: { ...current.Item, pk, sk, data: { ...currentData, ...patch } },
          ConditionExpression: 'attribute_exists(pk)',
        }),
      );
    },

    async remove(collection, id) {
      const sk = makeSk(collection, id);
      try {
        await client.send(
          new DeleteCommand({
            TableName: TABLE,
            Key: { pk, sk },
            ConditionExpression: 'attribute_exists(pk)',
          }),
        );
      } catch (err) {
        if (isConditionalCheckFailed(err)) throw new EntryNotFoundError(collection, id);
        throw err;
      }
    },
  };

  return fn(helpers);
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'ConditionalCheckFailedException'
  );
}

// Unused but exported — UpdateCommand import would be tree-shaken without it.
export { UpdateCommand };
`;
