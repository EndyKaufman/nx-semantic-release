import { ExecutorContext, createProjectGraphAsync } from '@nx/devkit';
import type { AnalyzeCommitsContext, Commit } from 'semantic-release';
import { PluginFn } from 'semantic-release-plugin-decorators';
import { isCommitAffectingProjects } from '../common/git';
import { getProjectDependencies } from '../common/project';
import { promiseFilter } from '../utils/promise-filter';
import { executorContext } from './executor-context';

export const getCommitsForProject =
  (verbose?: boolean) =>
  (plugin: PluginFn) =>
  async (config: unknown, context: AnalyzeCommitsContext) => {
    if (!executorContext) {
      throw new Error('Executor context is missing.');
    }

    if (!context.commits) {
      throw new Error('Commits are missing.');
    }

    const filteredCommits = await filterCommits(
      context.commits as [],
      executorContext,
      context,
      verbose
    );

    return plugin(config, {
      ...context,
      commits: filteredCommits,
    });
  };

async function filterCommits(
  commits: Commit[],
  executorContext: ExecutorContext,
  context: AnalyzeCommitsContext,
  verbose?: boolean
) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const projectName = executorContext.projectName!;
  const { dependencies, graph } = await getProjectDependencies(
    projectName,
    await createProjectGraphAsync()
  );
  const allDeps = [...dependencies, projectName];

  if (verbose) {
    context.logger.log(
      `Found following dependencies: "${dependencies.join(
        ', '
      )}" for project "${projectName}"`
    );
  }

  const result = await promiseFilter(commits, (commit) =>
    isCommitAffectingProjects({
      commit,
      projects: allDeps,
      context: context,
      verbose: verbose,
      graph,
      projectName,
    })
  );

  if (verbose) {
    context.logger.log(
      `Filtered ${result.length} commits out of ${commits.length}`
    );
  }

  return result;
}
