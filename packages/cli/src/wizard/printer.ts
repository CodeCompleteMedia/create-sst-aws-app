import pc from 'picocolors';

export const { green, yellow, red, cyan, bold, dim, blue } = pc;

export function header(text: string): void {
  console.log(`\n${bold(cyan(text))}`);
}

export function pass(label: string, detail?: string): void {
  const suffix = detail ? ` ${dim(detail)}` : '';
  console.log(`  ${green('✓')} ${label}${suffix}`);
}

export function fail(label: string, detail?: string): void {
  const suffix = detail ? ` ${dim(detail)}` : '';
  console.log(`  ${red('✗')} ${label}${suffix}`);
}

export function warn(label: string, detail?: string): void {
  const suffix = detail ? ` ${dim(detail)}` : '';
  console.log(`  ${yellow('!')} ${label}${suffix}`);
}

export function info(text: string): void {
  console.log(`    ${dim(text)}`);
}

export function instruction(title: string, block: string): void {
  console.log(`\n  ${bold(yellow('→'))} ${bold(title)}`);
  const lines = block.trim().split('\n');
  for (const line of lines) {
    console.log(`    ${line}`);
  }
  console.log();
}
