export default `{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignore": ["**/dist", "**/.astro", "**/node_modules", "packages/infra/.sst"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "off",
        "useImportType": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "correctness": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": [
              {
                "name": "@aws-sdk/client-dynamodb",
                "message": "Use withTenant() from packages/server/src/multitenancy/with-tenant.ts"
              },
              {
                "name": "@aws-sdk/lib-dynamodb",
                "message": "Use withTenant() from packages/server/src/multitenancy/with-tenant.ts"
              }
            ]
          }
        }
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  }
}
`;
