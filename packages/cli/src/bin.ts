import { cac } from 'cac';
import { runInit } from './commands/init.js';
import { runSetupAws } from './commands/setup-aws.js';
import { red } from './wizard/printer.js';


const cli = cac('easy-aws-deploy');

cli
  .command('init <project-name>', 'Scaffold a new SST v3 project with production-grade AWS patterns')
  .option('--dry-run', 'Show what would be generated without writing files')
  .option('-y, --yes', 'Accept all defaults (non-interactive)')
  .action(async (projectName: string, options: { dryRun?: boolean; yes?: boolean }) => {
    await runInit(projectName, { dryRun: options.dryRun, yes: options.yes }).catch(fail);
  });

cli
  .command('setup-aws', 'Check AWS prerequisites and print fix instructions')
  .option('--profile <profile>', 'AWS profile to use for checks')
  .option('--project <name>', 'Project name (used for expected profile name)')
  .option('--repo <org/repo>', 'GitHub org/repo (used for trust policy verification)')
  .option('--branch <branch>', 'Production branch', { default: 'main' })
  .action(
    async (options: {
      profile?: string;
      project?: string;
      repo?: string;
      branch?: string;
    }) => {
      const { runSetupAws: run } = await import('./commands/setup-aws.js');
      await run({
        profile: options.profile,
        projectName: options.project,
        githubOrgRepo: options.repo,
        githubBranch: options.branch ?? 'main',
      }).catch(fail);
    },
  );

cli
  .command('ui', 'Start the web UI for guided AWS setup and project generation')
  .option('--port <port>', 'Port to listen on', { default: 3847 })
  .action(async (options: { port?: number }) => {
    const { runUi } = await import('./commands/ui.js');
    await runUi({ port: options.port }).catch(fail);
  });

cli.help();
cli.version('0.1.0');
cli.parse();

function fail(e: unknown): never {
  console.error(`\n${red('Error:')} ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
