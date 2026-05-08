export default `name: Deploy

on:
  push:
    branches:
      - {{GITHUB_BRANCH}}
# {{#if GENERATE_STAGING}}
      - staging
# {{/if GENERATE_STAGING}}
  workflow_dispatch:
    inputs:
      stage:
        description: 'Stage to deploy'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - prod
# {{#if GENERATE_STAGING}}
          - staging
# {{/if GENERATE_STAGING}}

permissions:
  id-token: write   # required for OIDC
  contents: read

jobs:
  deploy:
    name: Deploy (\${{ github.ref_name }})
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: '10'

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          # Role ARN for github-actions-deployer.
          # Trust policy is scoped to: repo:{{GITHUB_ORG_REPO}}:ref:refs/heads/{{GITHUB_BRANCH}}
          # Run: npx create-sst-aws-app setup-aws --repo {{GITHUB_ORG_REPO}} to verify this role exists.
          role-to-assume: {{OIDC_ROLE_ARN}}
          aws-region: {{AWS_REGION}}

      - name: Determine stage
        id: stage
        run: |
          if [ "\${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "name=\${{ github.event.inputs.stage }}" >> "\$GITHUB_OUTPUT"
          elif [ "\${{ github.ref_name }}" = "{{GITHUB_BRANCH}}" ]; then
            echo "name=prod" >> "\$GITHUB_OUTPUT"
# {{#if GENERATE_STAGING}}
          elif [ "\${{ github.ref_name }}" = "staging" ]; then
            echo "name=staging" >> "\$GITHUB_OUTPUT"
# {{/if GENERATE_STAGING}}
          else
            echo "name=dev" >> "\$GITHUB_OUTPUT"
          fi

      - name: Deploy
        run: pnpm sst deploy --stage \${{ steps.stage.outputs.name }}
        working-directory: packages/infra
`;
