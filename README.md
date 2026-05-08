# easy-aws-deploy

A CLI tool that scaffolds production-grade AWS projects using [SST v3](https://sst.dev). It codifies hard-won patterns for auth, multi-tenancy, CI/CD, and IAM setup that aren't well-documented anywhere — so you don't have to rediscover them for every new project.

## What it does

**`init`** — Interactive wizard that generates a fully-wired SST v3 project:
- DynamoDB single-table design with `TENANT#<id>` partition key isolation
- Cognito + KMS asymmetric JWT hybrid auth (handles the two-issuer problem for inline editors on tenant domains)
- CloudFront + S3 + Lambda wiring with OAC
- GitHub Actions OIDC deployment (no long-lived credentials)
- `withTenant()` isolation wrapper with Biome lint enforcement

**`setup-aws`** — Checks AWS prerequisites and prints exact fix instructions for any gaps:
- AWS CLI and credentials
- GitHub OIDC provider
- `github-actions-deployer` IAM role with scoped trust policy
- SST bootstrap bucket
- ACM region requirements for CloudFront

**`ui`** — Starts a local web UI at `http://localhost:3847` with the same functionality in a visual interface, including real-time streaming of AWS prerequisite checks.

## Requirements

- Node.js 20+
- pnpm 9+
- AWS CLI (for `setup-aws`)

## Installation

```bash
npm install -g easy-aws-deploy
```

Or run without installing:

```bash
npx easy-aws-deploy init my-project
```

## Usage

### Web UI (recommended for first-time setup)

```bash
easy-aws-deploy ui
```

Opens a browser at `http://localhost:3847` with guided AWS setup, project generation, and a step-by-step deploy guide.

### CLI

```bash
# Scaffold a new project
easy-aws-deploy init my-project

# Skip prompts and accept defaults
easy-aws-deploy init my-project --yes

# Preview what would be generated without writing files
easy-aws-deploy init my-project --dry-run

# Check AWS prerequisites
easy-aws-deploy setup-aws

# Check prerequisites scoped to a specific project and repo
easy-aws-deploy setup-aws --project my-project --repo myorg/myrepo --branch main
```

## Project structure

```
easyAwsDeploy/
├── packages/
│   ├── cli/                  # CLI binary (easy-aws-deploy)
│   │   └── src/
│   │       ├── bin.ts        # Command entrypoint
│   │       ├── commands/     # init, setup-aws, ui
│   │       ├── aws/          # Read-only AWS SDK probes + IAM policy generators
│   │       ├── renderer/     # Template engine + file writer
│   │       ├── server/       # Fastify HTTP server + API routes
│   │       ├── templates/    # SST config, auth, multi-tenancy, CI/CD templates
│   │       ├── wizard/       # CLI prompt helpers
│   │       └── types.ts      # Shared types
│   └── ui/                   # React + Vite web UI
│       └── src/
│           ├── pages/        # Prerequisites, InitWizard, DeployGuide
│           └── components/   # CodeBlock, StatusBadge, StepCard
```

## Development

```bash
# Install dependencies
pnpm install

# Build everything (UI → CLI → copy assets) — required before first dev run
pnpm build

# Start all dev processes concurrently (tsup watch + Fastify server + Vite HMR)
pnpm dev

# Type check all packages
pnpm typecheck

# Format and lint
pnpm format
pnpm check
```

`pnpm dev` runs three processes in parallel:
- **cli** — tsup in watch mode; rebuilds `packages/cli/dist/` on source change
- **server** — Fastify server via `node --watch`; restarts automatically when the CLI rebuilds
- **ui** — Vite dev server on port 5173 with HMR; proxies `/api` requests to the Fastify server on port 3847

> Run `pnpm build` once before `pnpm dev` to ensure `packages/cli/dist/bin.js` exists for the server process to start.

## Generated project

Running `init` produces a pnpm monorepo with:

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

## Deploy guide

After generating a project:

1. Run `easy-aws-deploy setup-aws` to verify AWS prerequisites
2. `pnpm install && pnpm sst deploy --stage dev` — first pass, emits CloudFront URL
3. Set `PROJECT_EDITOR_URL=https://xxxxx.cloudfront.net` and run `pnpm sst deploy --stage dev` again — second pass wires the Cognito callback URL
4. Push to your production branch — GitHub Actions deploys automatically via OIDC

The two-pass deploy is required because the Cognito callback URL and the CloudFront URL depend on each other and cannot be resolved in a single pass.

## License

MIT
