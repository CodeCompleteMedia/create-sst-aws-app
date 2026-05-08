import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        position: 'relative',
        background: '#0a0d14',
        border: '1px solid #2d3748',
        borderRadius: 6,
        marginTop: 8,
      }}
    >
      <button
        type="button"
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: copied ? '#10b981' : '#2d3748',
          color: '#e2e8f0',
          border: 'none',
          borderRadius: 4,
          padding: '3px 10px',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.2s',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          paddingRight: 70,
          fontSize: 12,
          lineHeight: 1.6,
          color: '#a5b4fc',
          fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
