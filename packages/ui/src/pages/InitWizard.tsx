import { useState } from 'react';

interface FormData {
  // Phase 1
  projectName: string;
  awsRegion: string;
  projectType: 'cms' | 'api' | 'static';
  // Phase 2
  authStrategy: 'cognito-kms' | 'cognito' | 'none';
  editorDomain: string;
  // Phase 3
  tenantIsolation: 'single-table' | 'separate-tables';
  expectedTenantCount: '<75' | '75+';
  // Phase 4
  githubOrgRepo: string;
  githubBranch: string;
  devAccountId: string;
  prodAccountId: string;
  // Phase 5
  generateStaging: boolean;
}

const INITIAL: FormData = {
  projectName: '',
  awsRegion: 'us-west-2',
  projectType: 'cms',
  authStrategy: 'cognito-kms',
  editorDomain: '',
  tenantIsolation: 'single-table',
  expectedTenantCount: '<75',
  githubOrgRepo: '',
  githubBranch: 'main',
  devAccountId: '',
  prodAccountId: '',
  generateStaging: true,
};

const AWS_REGIONS = [
  { value: 'us-west-2', label: 'us-west-2 (Oregon — recommended)' },
  { value: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { value: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
  { value: 'eu-central-1', label: 'eu-central-1 (Frankfurt)' },
  { value: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)' },
];

// Styles
const card: React.CSSProperties = {
  background: '#1a1f2e',
  border: '1px solid #2d3748',
  borderRadius: 8,
  padding: '20px 24px',
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  background: '#0f1117',
  border: '1px solid #2d3748',
  borderRadius: 6,
  color: '#e2e8f0',
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#718096',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#e2e8f0',
  marginBottom: 14,
  marginTop: 0,
};

interface RadioGroupProps {
  name: string;
  value: string;
  options: { value: string; label: string; sub?: string }[];
  onChange: (v: string) => void;
}

function RadioGroup({ name, value, options, onChange }: RadioGroupProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 6,
            border: `1px solid ${value === opt.value ? '#6366f1' : '#2d3748'}`,
            background: value === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            style={{ marginTop: 2, accentColor: '#6366f1', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500 }}>{opt.label}</div>
            {opt.sub && (
              <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>{opt.sub}</div>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

const TOTAL_PHASES = 5;

export function InitWizard() {
  const [phase, setPhase] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const canAdvance = (): boolean => {
    if (phase === 1) return form.projectName.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (phase < TOTAL_PHASES) setPhase((p) => p + 1);
  };

  const handleBack = () => {
    if (phase > 1) setPhase((p) => p - 1);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/project/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.projectName || 'my-project'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const showTenantPhase = form.projectType === 'cms';
  const effectiveTotal = showTenantPhase ? TOTAL_PHASES : TOTAL_PHASES - 1;

  return (
    <div>
      <h1
        style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginTop: 0, marginBottom: 6 }}
      >
        New Project Wizard
      </h1>
      <p style={{ fontSize: 14, color: '#718096', marginTop: 0, marginBottom: 24 }}>
        Generate a production-ready SST v3 project scaffold, downloaded as a zip.
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#718096' }}>
            Phase {phase} of {effectiveTotal}
          </span>
          <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
            {Math.round(((phase - 1) / (effectiveTotal - 1)) * 100)}%
          </span>
        </div>
        <div style={{ height: 4, background: '#2d3748', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: '#6366f1',
              borderRadius: 2,
              width: `${((phase - 1) / (effectiveTotal - 1)) * 100}%`,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {['Identity', 'Auth', ...(showTenantPhase ? ['Tenancy'] : []), 'CI/CD', 'Staging'].map(
            (label, i) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 10,
                  color: i + 1 === phase ? '#6366f1' : i + 1 < phase ? '#10b981' : '#4a5568',
                  fontWeight: i + 1 === phase ? 700 : 400,
                }}
              >
                {i + 1 < phase ? '✓ ' : ''}
                {label}
              </div>
            ),
          )}
        </div>
      </div>

      {/* Phase 1: Identity */}
      {phase === 1 && (
        <div style={card}>
          <p style={sectionTitle}>Project Identity</p>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={labelStyle}>Project Name *</label>
              <input
                style={inputStyle}
                placeholder="my-project"
                value={form.projectName}
                onChange={(e) =>
                  set('projectName', e.target.value.toLowerCase().replace(/\s+/g, '-'))
                }
              />
              <p style={{ fontSize: 11, color: '#718096', margin: '4px 0 0' }}>
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            <div>
              <label style={labelStyle}>Primary AWS Region</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.awsRegion}
                onChange={(e) => set('awsRegion', e.target.value)}
              >
                {AWS_REGIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project Type</label>
              <RadioGroup
                name="projectType"
                value={form.projectType}
                onChange={(v) => set('projectType', v as FormData['projectType'])}
                options={[
                  {
                    value: 'cms',
                    label: 'Multi-tenant CMS',
                    sub: 'Like ccms — DynamoDB, CloudFront, multi-tenant SSR',
                  },
                  {
                    value: 'api',
                    label: 'Single-tenant web app',
                    sub: 'Cognito auth, Lambda API, CloudFront',
                  },
                  {
                    value: 'static',
                    label: 'API-only / Static site',
                    sub: 'No SSR — Lambda + API Gateway',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Phase 2: Auth */}
      {phase === 2 && (
        <div style={card}>
          <p style={sectionTitle}>Authentication</p>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={labelStyle}>Auth Strategy</label>
              <RadioGroup
                name="authStrategy"
                value={form.authStrategy}
                onChange={(v) => set('authStrategy', v as FormData['authStrategy'])}
                options={[
                  {
                    value: 'cognito-kms',
                    label: 'Cognito + KMS hybrid JWT',
                    sub: 'SPA auth + inline editor tokens (recommended for CMS)',
                  },
                  {
                    value: 'cognito',
                    label: 'Cognito only',
                    sub: 'SPA auth — standard Cognito JWT flow',
                  },
                  { value: 'none', label: 'None', sub: 'No authentication scaffolding' },
                ]}
              />
            </div>
            <div>
              <label style={labelStyle}>Editor Domain (optional)</label>
              <input
                style={inputStyle}
                placeholder="cms.your-agency.com"
                value={form.editorDomain}
                onChange={(e) => set('editorDomain', e.target.value)}
              />
              <p style={{ fontSize: 11, color: '#718096', margin: '4px 0 0' }}>
                Leave blank to configure later
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Phase 3: Multi-tenancy (CMS only) */}
      {phase === 3 && showTenantPhase && (
        <div style={card}>
          <p style={sectionTitle}>Multi-tenancy</p>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={labelStyle}>Tenant Isolation Model</label>
              <RadioGroup
                name="tenantIsolation"
                value={form.tenantIsolation}
                onChange={(v) => set('tenantIsolation', v as FormData['tenantIsolation'])}
                options={[
                  {
                    value: 'single-table',
                    label: 'Single-table DynamoDB',
                    sub: 'Partition key: TENANT#<id> — recommended for most cases',
                  },
                  {
                    value: 'separate-tables',
                    label: 'Separate tables per tenant',
                    sub: 'Stronger isolation, higher operational overhead',
                  },
                ]}
              />
            </div>
            <div>
              <label style={labelStyle}>Expected Tenant Count</label>
              <RadioGroup
                name="expectedTenantCount"
                value={form.expectedTenantCount}
                onChange={(v) => set('expectedTenantCount', v as FormData['expectedTenantCount'])}
                options={[
                  {
                    value: '<75',
                    label: 'Fewer than 75',
                    sub: 'Shared CloudFront distribution + SAN cert',
                  },
                  {
                    value: '75+',
                    label: '75+ tenants',
                    sub: 'Plan for multiple distributions — SAN cert limit exceeded',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Phase 4: CI/CD (phase 3 when no tenant phase) */}
      {((phase === 4 && showTenantPhase) || (phase === 3 && !showTenantPhase)) && (
        <div style={card}>
          <p style={sectionTitle}>CI/CD Configuration</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={labelStyle}>GitHub Org/Repo</label>
              <input
                style={inputStyle}
                placeholder="your-org/your-repo"
                value={form.githubOrgRepo}
                onChange={(e) => set('githubOrgRepo', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Production Branch</label>
              <input
                style={inputStyle}
                placeholder="main"
                value={form.githubBranch}
                onChange={(e) => set('githubBranch', e.target.value)}
              />
            </div>
            <div />
            <div>
              <label style={labelStyle}>Dev AWS Account ID</label>
              <input
                style={inputStyle}
                placeholder="123456789012"
                value={form.devAccountId}
                onChange={(e) => set('devAccountId', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Prod AWS Account ID</label>
              <input
                style={inputStyle}
                placeholder="Same as dev if blank"
                value={form.prodAccountId}
                onChange={(e) => set('prodAccountId', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Phase 5: Staging (phase 4 when no tenant phase) */}
      {((phase === 5 && showTenantPhase) || (phase === 4 && !showTenantPhase)) && (
        <div style={card}>
          <p style={sectionTitle}>Staging Environment</p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 6,
              border: `1px solid ${form.generateStaging ? '#6366f1' : '#2d3748'}`,
              background: form.generateStaging ? 'rgba(99,102,241,0.08)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={form.generateStaging}
              onChange={(e) => set('generateStaging', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#6366f1', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>
                Generate staging environment
              </div>
              <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
                Adds a staging stage to your GitHub Actions workflow (recommended)
              </div>
            </div>
          </label>

          {/* Summary */}
          <div
            style={{
              marginTop: 20,
              padding: '14px 16px',
              background: '#0f1117',
              borderRadius: 6,
              border: '1px solid #2d3748',
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#718096',
                margin: '0 0 10px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Project Summary
            </p>
            {[
              ['Project Name', form.projectName || '(not set)'],
              ['Region', form.awsRegion],
              ['Type', form.projectType],
              ['Auth', form.authStrategy],
              ['GitHub Repo', form.githubOrgRepo || '(not set)'],
              ['Branch', form.githubBranch],
              ['Dev Account', form.devAccountId || '(not set)'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#718096', minWidth: 110 }}>{label}</span>
                <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{value}</span>
              </div>
            ))}
          </div>

          {error && <p style={{ marginTop: 12, color: '#ef4444', fontSize: 13 }}>Error: {error}</p>}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button
          type="button"
          onClick={handleBack}
          disabled={phase === 1}
          style={{
            background: 'transparent',
            border: '1px solid #2d3748',
            borderRadius: 6,
            color: phase === 1 ? '#4a5568' : '#e2e8f0',
            fontSize: 14,
            padding: '9px 20px',
            cursor: phase === 1 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Back
        </button>

        {phase < effectiveTotal ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance()}
            style={{
              background: canAdvance() ? '#6366f1' : '#374151',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              padding: '9px 24px',
              cursor: canAdvance() ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            style={{
              background: loading ? '#4338ca' : '#6366f1',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              padding: '9px 24px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {loading && (
              <span
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            )}
            {loading ? 'Generating...' : 'Generate Project'}
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
