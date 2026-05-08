import { useState } from 'react';
import { DeployGuide } from './pages/DeployGuide.js';
import { InitWizard } from './pages/InitWizard.js';
import { Prerequisites } from './pages/Prerequisites.js';

type View = 'prerequisites' | 'init' | 'guide';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'prerequisites', label: 'AWS Setup', icon: '🔍' },
  { id: 'init', label: 'New Project', icon: '🚀' },
  { id: 'guide', label: 'Deploy Guide', icon: '📖' },
];

const styles = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    background: '#0f1117',
  } as React.CSSProperties,
  sidebar: {
    width: 220,
    background: '#1a1f2e',
    borderRight: '1px solid #2d3748',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '0',
    flexShrink: 0,
  } as React.CSSProperties,
  logoArea: {
    padding: '24px 20px 20px',
    borderBottom: '1px solid #2d3748',
  } as React.CSSProperties,
  logoIcon: {
    fontSize: 28,
    marginBottom: 6,
    display: 'block',
  } as React.CSSProperties,
  logoText: {
    fontSize: 15,
    fontWeight: 700,
    color: '#e2e8f0',
    letterSpacing: '-0.3px',
  } as React.CSSProperties,
  logoSub: {
    fontSize: 11,
    color: '#718096',
    marginTop: 2,
  } as React.CSSProperties,
  nav: {
    flex: 1,
    padding: '12px 0',
  } as React.CSSProperties,
  navItem: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    color: active ? '#e2e8f0' : '#718096',
    background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
    borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
    transition: 'all 0.15s',
    userSelect: 'none',
  }),
  navIcon: {
    fontSize: 16,
    flexShrink: 0,
  } as React.CSSProperties,
  version: {
    padding: '16px 20px',
    borderTop: '1px solid #2d3748',
    fontSize: 11,
    color: '#4a5568',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '32px',
    maxWidth: 900,
  } as React.CSSProperties,
};

export function App() {
  const [view, setView] = useState<View>('prerequisites');

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <span style={styles.logoIcon}>☁</span>
          <div style={styles.logoText}>create-sst-aws-app</div>
          <div style={styles.logoSub}>AWS deployment toolkit</div>
        </div>
        <nav style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              style={styles.navItem(view === item.id)}
              onClick={() => setView(item.id)}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div style={styles.version}>v0.1.0</div>
      </aside>
      <main style={styles.main}>
        {view === 'prerequisites' && <Prerequisites />}
        {view === 'init' && <InitWizard />}
        {view === 'guide' && <DeployGuide />}
      </main>
    </div>
  );
}
