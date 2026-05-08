import { startServer } from '../server/http.js';
import { bold, cyan, green } from '../wizard/printer.js';

export async function runUi(opts: { port?: number } = {}) {
  const port = opts.port ?? 3847;
  console.log(`\n${bold('create-sst-aws-app')} — starting web UI...\n`);

  const url = await startServer(port);
  console.log(`  ${green('✓')} Server running at ${cyan(url)}\n`);
  console.log(`  ${bold('Opening browser...')}`);

  // Open browser
  const { default: open } = await import('open');
  await open(url);

  console.log(`\n  Press ${bold('Ctrl+C')} to stop.\n`);

  // Keep alive
  await new Promise(() => {});
}
