import { CodeBlock } from '../components/CodeBlock.js';

const card: React.CSSProperties = {
  background: '#1a1f2e',
  border: '1px solid #2d3748',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 16,
};

const stepNumStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: '50%',
  background: '#6366f1',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  flexShrink: 0,
  marginRight: 12,
};

const stepTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#e2e8f0',
};

const bodyText: React.CSSProperties = {
  fontSize: 13,
  color: '#a0aec0',
  lineHeight: 1.7,
  marginTop: 10,
  marginBottom: 0,
};

interface StepProps {
  num: number;
  title: string;
  children: React.ReactNode;
}

function Step({ num, title, children }: StepProps) {
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <span style={stepNumStyle}>{num}</span>
        <span style={stepTitleStyle}>{title}</span>
      </div>
      <div style={{ paddingLeft: 40 }}>{children}</div>
    </div>
  );
}

export function DeployGuide() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginTop: 0, marginBottom: 6 }}>
        Deploy Guide
      </h1>
      <p style={{ fontSize: 14, color: '#718096', marginTop: 0, marginBottom: 24 }}>
        Step-by-step instructions to go from generated project to a live deployment.
      </p>

      <Step num={1} title="Verify AWS Prerequisites">
        <p style={bodyText}>
          Before deploying, confirm that your AWS account has the required GitHub OIDC provider,
          IAM deployer role, and SST bootstrap bucket. Use the{' '}
          <strong style={{ color: '#e2e8f0' }}>AWS Setup</strong> tab to run live checks,
          or run from the terminal:
        </p>
        <CodeBlock code="easy-aws-deploy setup-aws --project my-project --repo your-org/your-repo" />
        <p style={bodyText}>
          Fix any failing steps before continuing. All 7 checks should be green (or warned
          with no blockers).
        </p>
      </Step>

      <Step num={2} title="First Deploy">
        <p style={bodyText}>
          Navigate into the generated project directory, install dependencies, and trigger
          the first SST deploy to your dev stage. SST will output a CloudFront URL at the
          end of a successful deploy.
        </p>
        <CodeBlock code={`cd your-project
pnpm install
pnpm sst deploy --stage dev`} />
        <p style={bodyText}>
          The deploy typically takes 3–8 minutes on first run (CloudFront distributions take
          time to provision). Look for the{' '}
          <code style={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: 12 }}>CloudFrontUrl</code>{' '}
          in the SST output — you will need it in the next step if you use Cognito.
        </p>
      </Step>

      <Step num={3} title="Wire Cognito Callback URL (Cognito projects only)">
        <p style={bodyText}>
          If you chose Cognito or Cognito + KMS auth, Cognito needs to know your CloudFront
          URL as an allowed callback. After the first deploy prints the URL, set it as an
          environment variable and re-deploy:
        </p>
        <CodeBlock code={`# Replace with your actual CloudFront URL from step 2 output
export MY_PROJECT_EDITOR_URL=https://dxxxxxxxxxxxxx.cloudfront.net

# Second deploy — wires the Cognito callback URL
pnpm sst deploy --stage dev`} />
        <p style={bodyText}>
          This two-pass deploy is required because the CloudFront URL is only known after the
          first deployment creates the distribution. Subsequent deploys do not need this step.
        </p>
      </Step>

      <Step num={4} title="Verify Authentication">
        <p style={bodyText}>
          Visit your CloudFront URL in a browser. You should be redirected to the Cognito
          hosted UI for sign-up and login. Create a test account, sign in, and verify that
          the JWT auth flow works end-to-end.
        </p>
        <CodeBlock code={`# Check your CloudFront URL (printed in SST deploy output)
open https://dxxxxxxxxxxxxx.cloudfront.net

# Or check SST resource outputs directly
pnpm sst outputs --stage dev`} />
        <p style={bodyText}>
          If you see auth errors, check that the Cognito User Pool callback URL matches your
          CloudFront domain exactly (including the trailing path if any).
        </p>
      </Step>

      <Step num={5} title="Production Deploy via GitHub Actions">
        <p style={bodyText}>
          Push to your production branch (e.g. <code style={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: 12 }}>main</code>).
          The generated GitHub Actions workflow will automatically deploy to prod using
          OIDC — no long-lived AWS credentials required.
        </p>
        <CodeBlock code={`git add .
git commit -m "Initial project setup"
git push origin main`} />
        <p style={bodyText}>
          The workflow uses the IAM role{' '}
          <code style={{ fontFamily: 'monospace', color: '#a5b4fc', fontSize: 12 }}>github-actions-deployer</code>{' '}
          via OIDC federation — short-lived tokens only. Monitor the Actions tab in GitHub
          to watch the deploy progress.
        </p>
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 6,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#f59e0b', lineHeight: 1.6 }}>
            <strong>ACM Certificate Note:</strong> CloudFront SSL certificates must be
            created in <code style={{ fontFamily: 'monospace' }}>us-east-1</code> regardless of your
            primary region. The generated{' '}
            <code style={{ fontFamily: 'monospace' }}>sst.config.ts</code> handles this automatically
            for the default CloudFront domain. Custom domains require a manual ACM cert in
            us-east-1.
          </p>
        </div>
      </Step>

      <div
        style={{
          marginTop: 24,
          padding: '16px 20px',
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20 }}>✓</span>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#10b981' }}>
            You are live!
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#718096' }}>
            Future deploys trigger automatically on every push to your production branch.
          </p>
        </div>
      </div>
    </div>
  );
}
