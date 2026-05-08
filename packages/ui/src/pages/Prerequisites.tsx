import { useState, useEffect, useRef } from 'react';
import { StepCard } from '../components/StepCard.js';

type Status = 'pass' | 'fail' | 'warn' | 'pending' | 'running';

interface CheckResult {
  step: number;
  title: string;
  status: Status;
  description: string;
  fix?: string;
}

interface FormState {
  project: string;
  repo: string;
  branch: string;
  profile: string;
}

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
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export function Prerequisites() {
  const [form, setForm] = useState<FormState>({ project: '', repo: '', branch: 'main', profile: '' });
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const runChecks = () => {
    if (running) return;
    esRef.current?.close();

    setResults([]);
    setDone(false);
    setRunning(true);

    const params = new URLSearchParams();
    if (form.project) params.set('project', form.project);
    if (form.repo) params.set('repo', form.repo);
    if (form.branch) params.set('branch', form.branch);
    if (form.profile) params.set('profile', form.profile);

    const es = new EventSource(`/api/aws/check?${params.toString()}`);
    esRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as CheckResult & { done?: boolean };
      if (data.done) {
        setRunning(false);
        setDone(true);
        es.close();
        return;
      }
      setResults((prev) => {
        const idx = prev.findIndex((r) => r.step === data.step);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data;
          return next;
        }
        return [...prev, data];
      });
    };

    es.onerror = () => {
      setRunning(false);
      es.close();
    };
  };

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginTop: 0, marginBottom: 6 }}>
        AWS Prerequisites
      </h1>
      <p style={{ fontSize: 14, color: '#718096', marginTop: 0, marginBottom: 24 }}>
        Live-check all required AWS setup steps. Fix any failures before deploying.
      </p>

      {/* Form */}
      <div
        style={{
          background: '#1a1f2e',
          border: '1px solid #2d3748',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
          <div>
            <label style={labelStyle}>Project Name</label>
            <input
              style={inputStyle}
              placeholder="my-project"
              value={form.project}
              onChange={handleChange('project')}
            />
          </div>
          <div>
            <label style={labelStyle}>GitHub Org/Repo</label>
            <input
              style={inputStyle}
              placeholder="your-org/your-repo"
              value={form.repo}
              onChange={handleChange('repo')}
            />
          </div>
          <div>
            <label style={labelStyle}>Branch</label>
            <input
              style={inputStyle}
              placeholder="main"
              value={form.branch}
              onChange={handleChange('branch')}
            />
          </div>
          <div>
            <label style={labelStyle}>AWS Profile (optional)</label>
            <input
              style={inputStyle}
              placeholder="default"
              value={form.profile}
              onChange={handleChange('profile')}
            />
          </div>
        </div>

        <button
          onClick={runChecks}
          disabled={running}
          style={{
            marginTop: 16,
            background: running ? '#4338ca' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '9px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: running ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: running ? 0.8 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {running && (
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
          {running ? 'Running checks...' : 'Run Checks'}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          {results.map((r) => (
            <StepCard
              key={r.step}
              step={r.step}
              title={r.title}
              status={r.status}
              description={r.description}
              fix={r.fix}
            />
          ))}
          {done && (
            <p style={{ fontSize: 13, color: '#718096', marginTop: 16, textAlign: 'center' }}>
              All checks complete. Fix any failures above, then re-run.
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
