type Status = 'pass' | 'fail' | 'warn' | 'pending' | 'running';

interface StatusBadgeProps {
  status: Status;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: string }> = {
  pass: { label: 'Pass', color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '✓' },
  fail: { label: 'Fail', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '✗' },
  warn: { label: 'Warn', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '!' },
  pending: { label: 'Pending', color: '#718096', bg: 'rgba(113,128,150,0.12)', icon: '○' },
  running: { label: 'Running', color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '◌' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        animation: status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
      }}
    >
      <span style={{ fontSize: 11 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
