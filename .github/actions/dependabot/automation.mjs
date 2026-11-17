import { Buffer } from 'node:buffer';
import { isDeepStrictEqual } from 'node:util';

const dependencyFields = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const isLintDependency = (name) =>
  name === '@tjsr/eslint-config' ||
  name === 'eslint' ||
  name === 'typescript-eslint' ||
  name.startsWith('eslint-') ||
  name.startsWith('@eslint/') ||
  name.startsWith('@typescript-eslint/') ||
  name.startsWith('@stylistic/');

// This identifies the update's scope. npm and the repository's CI own dependency resolution.
const lintOnly = (basePackage, headPackage, baseLock, headLock) => {
  const withoutDependencies = (manifest) =>
    Object.fromEntries(Object.entries(manifest).filter(([key]) => !dependencyFields.includes(key)));
  if (!isDeepStrictEqual(withoutDependencies(basePackage), withoutDependencies(headPackage))) return false;
  if (!baseLock.packages || !headLock.packages) return false;
  const changed = new Set();
  const direct = new Set();
  for (const field of dependencyFields) {
    const before = basePackage[field] || {};
    const after = headPackage[field] || {};
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      direct.add(name);
      if (before[name] !== after[name]) changed.add(name);
    }
  }
  for (const name of direct) {
    const path = `node_modules/${name}`;
    if (!isDeepStrictEqual(baseLock.packages[path], headLock.packages[path])) changed.add(name);
  }
  return changed.size > 0 && [...changed].every(isLintDependency);
};

const run = async ({ github, context, core, scope, workflows }) => {
  if (!['all', 'linter'].includes(scope) || !Array.isArray(workflows) || workflows.length === 0) {
    throw new Error('An explicit dependency scope and at least one CI workflow are required.');
  }
  const repo = context.repo;
  const fullName = `${repo.owner}/${repo.repo}`;
  const { data: repository } = await github.rest.repos.get(repo);
  const base = repository.default_branch;
  const list = (method, args) => github.paginate(method, { ...repo, per_page: 100, ...args });
  const mainSha = async () => (await github.rest.repos.getBranch({ ...repo, branch: base })).data.commit.sha;
  const getPr = async (number) => (await github.rest.pulls.get({ ...repo, pull_number: number })).data;
  const owned = (pr) =>
    pr.state === 'open' &&
    !pr.draft &&
    pr.user.login === 'dependabot[bot]' &&
    pr.base.ref === base &&
    pr.head.repo?.full_name === fullName &&
    pr.head.ref.startsWith('dependabot/');
  const trusted = async (pr) => {
    if (!owned(pr)) return false;
    const commits = await list(github.rest.pulls.listCommits, { pull_number: pr.number });
    return (
      commits.length > 0 &&
      commits.every(
        (commit) => commit.author?.login === 'dependabot[bot]' && commit.commit.verification?.verified === true
      )
    );
  };
  const jsonAt = async (path, ref) => {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
    if (Array.isArray(data) || data.encoding !== 'base64') throw new Error(`Cannot read ${path} at ${ref}`);
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  };
  const eligible = async (pr, baseSha) => {
    const files = await list(github.rest.pulls.listFiles, { pull_number: pr.number });
    if (!files.length || files.some((file) => file.status !== 'modified')) return false;
    if (scope === 'all' && pr.head.ref.startsWith('dependabot/github_actions/')) {
      return files.every((file) => /^\.github\/(workflows\/[^/]+|actions\/.+\/action)\.ya?ml$/.test(file.filename));
    }
    if (
      !pr.head.ref.startsWith('dependabot/npm_and_yarn/') ||
      !files.every((file) => ['package.json', 'package-lock.json'].includes(file.filename))
    )
      return false;
    if (scope === 'all') return true;
    const manifests = await Promise.all([
      jsonAt('package.json', baseSha),
      jsonAt('package.json', pr.head.sha),
      jsonAt('package-lock.json', baseSha),
      jsonAt('package-lock.json', pr.head.sha),
    ]);
    return lintOnly(...manifests);
  };
  const rebase = async (pr, baseSha) => {
    const { data: comparison } = await github.rest.repos.compareCommitsWithBasehead({
      ...repo,
      basehead: `${baseSha}...${pr.head.sha}`,
    });
    if (comparison.behind_by === 0) return false;
    const marker = `<!-- dependabot-rebase:${baseSha}:${pr.head.sha} -->`;
    const comments = await list(github.rest.issues.listComments, { issue_number: pr.number });
    if (!comments.some((comment) => comment.body?.includes(marker))) {
      await github.rest.issues.createComment({
        ...repo,
        body: `@dependabot rebase\n\n${marker}`,
        issue_number: pr.number,
      });
    }
    core.info(`PR #${pr.number}: waiting for Dependabot to rebase onto ${baseSha}.`);
    return true;
  };
  const green = async (pr) => {
    const runs = await list(github.rest.actions.listWorkflowRunsForRepo, { head_sha: pr.head.sha });
    for (const path of workflows) {
      const relevant = runs.filter(
        (item) =>
          item.path === path &&
          item.head_sha === pr.head.sha &&
          item.head_repository?.full_name === fullName &&
          item.head_branch === pr.head.ref &&
          ['push', 'pull_request'].includes(item.event)
      );
      if (!relevant.length) return false;
      // Check the newest run for every event, so a rerun cannot hide a failed or pending build.
      const latest = new Map();
      for (const item of relevant) {
        if (!latest.has(item.event) || item.id > latest.get(item.event).id) latest.set(item.event, item);
      }
      for (const item of latest.values()) {
        if (item.status !== 'completed' || item.conclusion !== 'success') return false;
        const jobs = await list(github.rest.actions.listJobsForWorkflowRun, { filter: 'latest', run_id: item.id });
        if (
          !jobs.some((job) => job.conclusion === 'success') ||
          jobs.some((job) => job.status !== 'completed' || !['success', 'skipped', 'neutral'].includes(job.conclusion))
        )
          return false;
      }
    }
    const checks = await list(github.rest.checks.listForRef, { filter: 'latest', ref: pr.head.sha });
    if (
      checks.some(
        (check) => check.status !== 'completed' || !['success', 'skipped', 'neutral'].includes(check.conclusion)
      )
    )
      return false;
    const { data: status } = await github.rest.repos.getCombinedStatusForRef({ ...repo, ref: pr.head.sha });
    return status.total_count === 0 || status.state === 'success';
  };

  const pulls = await list(github.rest.pulls.list, { base, direction: 'asc', sort: 'created', state: 'open' });
  for (const listed of pulls) {
    const pr = await getPr(listed.number);
    if (!(await trusted(pr))) continue;
    const baseSha = await mainSha();
    if ((await rebase(pr, baseSha)) || !(await eligible(pr, baseSha)) || !(await green(pr))) continue;
    const reviews = await list(github.rest.pulls.listReviews, { pull_number: pr.number });
    const latestReviews = new Map();
    for (const review of reviews) {
      if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) {
        latestReviews.set(review.user.login, review);
      }
    }
    if ([...latestReviews.values()].some((review) => review.state === 'CHANGES_REQUESTED')) continue;
    let current = await getPr(pr.number);
    if (!owned(current) || current.head.sha !== pr.head.sha || (await mainSha()) !== baseSha) continue;
    if (
      !reviews.some(
        (review) =>
          review.user.login === 'github-actions[bot]' && review.state === 'APPROVED' && review.commit_id === pr.head.sha
      )
    ) {
      await github.rest.pulls.createReview({
        ...repo,
        body: 'Approved dependency update after all configured CI workflows passed on this commit.',
        commit_id: pr.head.sha,
        event: 'APPROVE',
        pull_number: pr.number,
      });
    }
    current = await getPr(pr.number);
    if (!owned(current) || current.head.sha !== pr.head.sha || (await mainSha()) !== baseSha) continue;
    const { data: merged } = await github.rest.pulls.merge({
      ...repo,
      merge_method: 'rebase',
      pull_number: pr.number,
      sha: pr.head.sha,
    });
    if (!merged.merged) throw new Error(`PR #${pr.number} was not merged: ${merged.message}`);
    core.info(`Rebase-merged PR #${pr.number} at ${pr.head.sha}.`);
    // GITHUB_TOKEN merges do not emit another Actions push run. Refresh the remaining PRs here too.
    const updatedBase = await mainSha();
    for (const other of pulls) {
      if (other.number === pr.number) continue;
      const remaining = await getPr(other.number);
      if (await trusted(remaining)) await rebase(remaining, updatedBase);
    }
    return;
  }
};

export { isLintDependency, lintOnly, run };
