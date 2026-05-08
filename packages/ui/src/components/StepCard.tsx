import { useState } from 'react';
import { CodeBlock } from './CodeBlock.js';
import { StatusBadge } from './StatusBadge.js';

type Status = 'pass' | 'fail' | 'warn' | 'pending' | 'running';

interface StepCardProps {
  step: number;
  title: string;
  status: Status;
  description: string;
  fix?: string;
}

export function StepCard({ step, title, status, description, fix }: StepCardProps) {
  const [fixOpen, setFixOpen] = useState(false);

  return (
    <div
      style={{
        background: '#1a1f2e',
        border: '1px solid #2d3748',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 12,
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#2d3748',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#718096',
            flexShrink: 0,
          }}
        >
          {step}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{title}</span>
            <StatusBadge status={status} />
          </div>
          {description && (
            <p
              style={{
                margin: '4px 0 0',
                fontSize: 13,
                color: '#718096',
                lineHeight: 1.5,
                wordBreak: 'break-all',
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {fix && (status === 'fail' || status === 'warn') && (
        <div style={{ marginTop: 12, paddingLeft: 42 }}>
          <button
            type="button"
            onClick={() => setFixOpen((o) => !o)}
            style={{
              background: 'none',
              border: '1px solid #2d3748',
              borderRadius: 4,
              color: '#6366f1',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 12px',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{fixOpen ? '▾' : '▸'}</span>
            Fix Instructions
          </button>
          {fixOpen && <CodeBlock code={fix} />}
        </div>
      )}
    </div>
  );
}
