import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { GeneratedFile } from '../types.js';
import { dim, green, yellow } from '../wizard/printer.js';

export async function writeFiles(
  projectDir: string,
  files: GeneratedFile[],
  opts: { dryRun?: boolean } = {},
): Promise<void> {
  for (const file of files) {
    const dest = join(projectDir, file.outputPath);
    const dir = dirname(dest);

    const exists = await fileExists(dest);
    const tag = exists ? yellow('update') : green('create');
    console.log(`  ${tag} ${dim(file.outputPath)}`);

    if (!opts.dryRun) {
      await mkdir(dir, { recursive: true });
      await writeFile(dest, file.content, 'utf8');
    }
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
