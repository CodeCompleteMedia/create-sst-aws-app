import prompts from 'prompts';
import type { PromptObject } from 'prompts';

export type { PromptObject };

export async function ask<T extends string = string>(
  questions: PromptObject | PromptObject[],
  opts: { onCancel?: () => void } = {},
): Promise<Record<T, unknown>> {
  const onCancel = opts.onCancel ?? (() => process.exit(0));
  return prompts(questions as PromptObject[], { onCancel }) as Promise<Record<T, unknown>>;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
