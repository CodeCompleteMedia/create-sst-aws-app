# create-sst-aws-app

Scaffold an [SST v3](https://sst.dev) project on AWS with production-grade patterns built in. Codifies hard-won knowledge about auth, multi-tenancy, CI/CD, and IAM setup that isn't well-documented anywhere — so you don't have to rediscover it for every new project.

## Quick start

```bash
npm create sst-aws-app my-project
# or
npx create-sst-aws-app my-project
```

Or for a guided web UI:

```bash
npx create-sst-aws-app ui
```

## What it generates

- **DynamoDB single-table** design with `TENANT#<id>` partition-key isolation
- **Cognito + KMS asymmetric JWT hybrid** auth (handles the two-issuer problem when an inline editor runs on tenant domains)
- **CloudFront + S3 + Lambda** with origin access control
- **GitHub Actions OIDC** deployment (no long-lived credentials)
- **`withTenant()`** isolation wrapper enforced via Biome `noRestrictedImports` lint rule

## Commands

```bash
# Scaffold a new project (default action)
npx create-sst-aws-app my-project

# Skip prompts and accept defaults
npx create-sst-aws-app my-project --yes

# Preview without writing files
npx create-sst-aws-app my-project --dry-run

# Check AWS prerequisites (OIDC, IAM role, SST bootstrap, ACM region)
npx create-sst-aws-app setup-aws --project my-project --repo your-org/your-repo

# Open the web UI for guided setup, project generation, and deploy steps
npx create-sst-aws-app ui
```

## Web UI

`create-sst-aws-app ui` starts a local server at `http://localhost:3847` with three tabs:

- **AWS Setup** — runs the prerequisite checks live, with copy-paste fix instructions including pre-filled trust-policy JSON for your repo
- **New Project** — visual 5-phase wizard; downloads a `.zip` of the generated project
- **Deploy Guide** — step-by-step post-init walkthrough including the two-pass deploy

## Requirements

- Node.js 20+
- pnpm 9+ (in the generated project)
- AWS CLI (for `setup-aws` checks)

## Generated project structure

```
my-project/
├── packages/
│   ├── infra/
│   │   └── sst.config.ts     # Full SST v3 config (KMS, Cognito, DynamoDB, CloudFront)
│   └── server/
│       └── src/
│           ├── auth/
│           │   ├── kms-jwt.ts      # mintKmsJwt, verifyKmsJwt, verifyEitherJwt
│           │   └── cognito.ts      # verifyCognitoAccessToken
│           ├── api/
│           │   └── handler.ts      # Lambda handler with dual-auth + tenant isolation
│           ├── multitenancy/
│           │   └── with-tenant.ts  # withTenant() wrapper + DynamoDB helpers
│           └── ssr/
│               └── tenant-resolver.ts
└── .github/
    └── workflows/
        └── deploy.yml        # OIDC-based GitHub Actions deploy
```

## Deploy flow

After generating a project:

1. Run `npx create-sst-aws-app setup-aws` to verify AWS prerequisites
2. `pnpm install && pnpm sst deploy --stage dev` — first pass, emits CloudFront URL
3. Set `PROJECT_EDITOR_URL=https://xxxxx.cloudfront.net` and run `pnpm sst deploy --stage dev` again — second pass wires the Cognito callback URL
4. Push to your production branch — GitHub Actions deploys automatically via OIDC

The two-pass deploy is required because the Cognito callback URL and the CloudFront URL depend on each other and cannot be resolved in a single pass.

## Development (this repo)

```bash
# Install
pnpm install

# Build everything (UI → CLI → copy assets) — required before first dev run
pnpm build

# Start all dev processes concurrently (tsup watch + Fastify server + Vite HMR)
pnpm dev

# Type check, format, lint
pnpm typecheck
pnpm format
pnpm check
```

`pnpm dev` runs three processes in parallel:
- **cli** — tsup in watch mode; rebuilds `packages/cli/dist/` on source change
- **server** — Fastify server via `node --watch`; restarts when the CLI rebuilds
- **ui** — Vite dev server on port 5173 with HMR; proxies `/api` requests to the Fastify server on port 3847

> Run `pnpm build` once before `pnpm dev` so `packages/cli/dist/bin.js` exists for the server process to start.

## Releasing

The CLI is published to npm via a GitHub Actions workflow that triggers on `v*` git tags.

**One-time setup:**
1. Create an [npm automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens)
2. Add it to the GitHub repo as a secret named `NPM_TOKEN`

**For each release:**
```bash
# 1. Bump version in packages/cli/package.json
# 2. Commit the bump
git commit -am "Release v0.2.0"

# 3. Tag and push
git tag v0.2.0
git push origin main --tags
```

The release workflow validates that the tag matches the `package.json` version, runs `pnpm build`, and publishes with [npm provenance](https://docs.npmjs.com/generating-provenance-statements). Manual publishing is also supported (`pnpm build && cd packages/cli && npm publish`); the `prepublishOnly` script ensures the build runs first either way.

## License

MIT
