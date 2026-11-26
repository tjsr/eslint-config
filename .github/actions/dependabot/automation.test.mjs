import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

import { lintOnly, run } from './automation.mjs';

const manifest = {
  devDependencies: { '@tjsr/eslint-config': 'github:tjsr/eslint-config#main', eslint: '^10.0.0', vitest: '^5.0.0' },
  name: 'consumer',
};
const lock = (config = 'old', eslint = 'old', vitest = 'old') => ({
  packages: {
    'node_modules/@tjsr/eslint-config': { resolved: config },
    'node_modules/eslint': { resolved: eslint },
    'node_modules/vitest': { resolved: vitest },
  },
});

test('accepts git SHA-only shared config updates and lint groups', () => {
  assert.equal(lintOnly(manifest, manifest, lock(), lock('new')), true);
  assert.equal(lintOnly(manifest, manifest, lock(), lock('new', 'new')), true);
});
test('rejects mixed groups, unrelated updates, missing lock metadata and package script changes', () => {
  assert.equal(lintOnly(manifest, manifest, lock(), lock('new', 'old', 'new')), false);
  assert.equal(lintOnly(manifest, manifest, lock(), lock('old', 'old', 'new')), false);
  assert.equal(lintOnly(manifest, manifest, {}, lock('new')), false);
  assert.equal(lintOnly(manifest, { ...manifest, scripts: { test: 'echo pass' } }, lock(), lock('new')), false);
  assert.equal(lintOnly(manifest, manifest, lock(), lock()), false);
});
test('accepts declared lint ranges and rejects non-lint declarations', () => {
  assert.equal(
    lintOnly(
      manifest,
      { ...manifest, devDependencies: { ...manifest.devDependencies, eslint: '^11.0.0' } },
      lock(),
      lock()
    ),
    true
  );
  assert.equal(
    lintOnly(
      manifest,
      { ...manifest, devDependencies: { ...manifest.devDependencies, vitest: '^6.0.0' } },
      lock(),
      lock()
    ),
    false
  );
});

test('recognises only the three approved Prettier tools in the lint scope', () => {
  const changed = (name) => ({ ...manifest, devDependencies: { ...manifest.devDependencies, [name]: '^1.0.0' } });
  for (const name of ['prettier', 'prettier-plugin-sort-members', '@trivago/prettier-plugin-sort-imports']) {
    assert.equal(lintOnly(manifest, changed(name), lock(), lock('new')), true);
  }
  for (const name of ['prettier-plugin-unrelated', '@trivago/unrelated', 'vitest']) {
    assert.equal(lintOnly(manifest, changed(name), lock(), lock('new')), false);
  }
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const fixture = (overrides = {}) => {
  const effects = [];
  const warnings = [];
  const pr = {
    base: { ref: 'main' },
    draft: false,
    head: { ref: 'dependabot/npm_and_yarn/linter-abc', repo: { full_name: 'tjsr/consumer' }, sha: 'tested-head' },
    number: 1,
    state: 'open',
    user: { login: 'dependabot[bot]' },
  };
  const state = {
    base: 'base',
    behind: false,
    actor: { login: 'maintainer', type: 'User' },
    permission: 'write',
    checks: [],
    comments: [],
    commits: [{ author: { login: 'dependabot[bot]' }, commit: { verification: { verified: true } } }],
    files: [{ filename: 'package-lock.json', status: 'modified' }],
    headLock: lock('new'),
    jobs: [{ conclusion: 'success', status: 'completed' }],
    prs: [pr],
    reviews: [],
    runs: [
      {
        conclusion: 'success',
        event: 'push',
        head_branch: pr.head.ref,
        head_repository: { full_name: 'tjsr/consumer' },
        head_sha: 'tested-head',
        id: 10,
        path: '.github/workflows/build.yml',
        status: 'completed',
      },
    ],
    status: { state: 'pending', total_count: 0 },
    ...overrides,
  };
  let gets = 0;
  const data = (value) => ({ data: value });
  const api = {
    actions: { listJobsForWorkflowRun: async () => state.jobs, listWorkflowRunsForRepo: async () => state.runs },
    checks: { listForRef: async () => state.checks },
    issues: {
      createComment: async (args) => {
        if (state.commentError) throw state.commentError;
        effects.push(['rebase', args]);
      },
      listComments: async () => state.comments,
    },
    users: {
      getAuthenticated: async () => {
        if (state.actorError) throw state.actorError;
        return data(state.actor);
      },
    },
    pulls: {
      createReview: async (args) => {
        effects.push(['approve', args]);
        if (state.onApproval) state.onApproval(state);
      },
      get: async ({ pull_number }) => {
        gets++;
        if (state.onGet) state.onGet(state, gets);
        return data(clone(state.prs.find((item) => item.number === pull_number)));
      },
      list: async () => state.prs,
      listCommits: async () => state.commits,
      listFiles: async () => state.files,
      listReviews: async () => state.reviews,
      merge: async (args) => {
        effects.push(['merge', args]);
        state.base = 'merged-base';
        state.behind = true;
        return data({ merged: true });
      },
    },
    repos: {
      compareCommitsWithBasehead: async () => data({ behind_by: state.behind ? 1 : 0 }),
      get: async () => data({ default_branch: 'main' }),
      getBranch: async () => data({ commit: { sha: state.base } }),
      getCollaboratorPermissionLevel: async () => data({ permission: state.permission }),
      getCombinedStatusForRef: async () => data(state.status),
      getContent: async ({ path, ref }) =>
        data({
          content: Buffer.from(
            JSON.stringify(path === 'package.json' ? manifest : ref === 'base' ? lock() : state.headLock)
          ).toString('base64'),
          encoding: 'base64',
        }),
    },
  };
  return {
    effects,
    execute: (scope = 'linter', workflows = ['.github/workflows/build.yml'], rebaseGithub) =>
      run({
        context: { repo: { owner: 'tjsr', repo: 'consumer' } },
        core: { info() {}, warning: (message) => warnings.push(message) },
        github: { paginate: (method, args) => method(args), rest: api },
        rebaseGithub,
        scope,
        workflows,
      }),
    state,
    warnings,
  };
};

test('approves the tested commit and uses SHA-guarded rebase merge', async () => {
  const f = fixture();
  await f.execute();
  assert.deepEqual(
    f.effects.map(([kind]) => kind),
    ['approve', 'merge']
  );
  assert.equal(f.effects[0][1].commit_id, 'tested-head');
  assert.equal(f.effects[1][1].sha, 'tested-head');
  assert.equal(f.effects[1][1].merge_method, 'rebase');
});
test('rebases stale branches without approving or merging, and deduplicates commands', async () => {
  const f = fixture({ behind: true });
  await f.execute();
  assert.deepEqual(
    f.effects.map(([kind]) => kind),
    ['rebase']
  );
  assert.match(f.effects[0][1].body, /^@dependabot rebase\n/);
  f.state.comments = [{ body: f.effects[0][1].body, user: { login: 'maintainer' } }];
  f.effects.length = 0;
  await f.execute();
  assert.deepEqual(f.effects, []);
});
test('keeps stale PRs blocked without posting through an installation token or a read-only user', async () => {
  for (const overrides of [
    { actorError: { status: 403 } },
    { actor: { login: 'github-actions[bot]', type: 'Bot' } },
    { permission: 'read' },
  ]) {
    const f = fixture({ ...overrides, behind: true });
    await f.execute();
    assert.deepEqual(f.effects, []);
    assert.match(f.warnings[0], /no verified user with push access/);
  }
});

test('uses an optional rebase credential only for identity, push access and the rebase comment', async () => {
  const f = fixture({ behind: true, actorError: { status: 403 } });
  const calls = [];
  await f.execute('linter', undefined, {
    rest: {
      users: {
        getAuthenticated: async () => ({ data: { login: 'rebaser', type: 'User' } }),
      },
      repos: {
        getCollaboratorPermissionLevel: async (args) => {
          calls.push(args);
          return { data: { permission: 'write' } };
        },
      },
      issues: {
        createComment: async (args) => calls.push(args),
      },
    },
  });
  assert.deepEqual(f.effects, []);
  assert.equal(calls[0].username, 'rebaser');
  assert.match(calls[1].body, /^@dependabot rebase/);
});

test('does not retry a rejected command for the same actor and head after main advances', async () => {
  const command = (login) => ({ body: '@dependabot rebase\n\n<!-- dependabot-rebase:old:tested-head -->', user: { login } });
  const refusal = {
    body: 'Sorry, only users with push access can use that command.',
    user: { login: 'dependabot[bot]' },
  };
  const denied = fixture({ behind: true, comments: [command('maintainer'), refusal] });
  await denied.execute();
  assert.deepEqual(denied.effects, []);
  assert.match(denied.warnings[0], /denied this actor's rebase/);

  for (const comments of [
    [command('github-actions[bot]'), refusal],
    [command('maintainer'), { ...refusal, user: { login: 'other' } }],
    [command('maintainer'), { body: '@dependabot rebase', user: { login: 'other' } }, refusal],
    [{ ...command('maintainer'), body: '@dependabot rebase' }, refusal],
  ]) {
    const f = fixture({ behind: true, comments });
    await f.execute();
    assert.deepEqual(f.effects.map(([kind]) => kind), ['rebase']);
  }
});

test('handles comment authorization failure and checks for concurrent head/base changes', async () => {
  const denied = fixture({ behind: true, commentError: { status: 403 } });
  await denied.execute();
  assert.deepEqual(denied.effects, []);
  assert.match(denied.warnings[0], /cannot post the rebase request/);

  for (const change of ['head', 'base', 'closed']) {
    const f = fixture({
      behind: true,
      onGet: (state, count) => {
        if (count !== 2) return;
        if (change === 'head') state.prs[0].head.sha = 'new-head';
        if (change === 'base') state.base = 'new-base';
        if (change === 'closed') state.prs[0].state = 'closed';
      },
    });
    await f.execute();
    assert.deepEqual(f.effects, []);
  }
});

test('refreshes other branches after a token merge even without a push event', async () => {
  const f = fixture();
  f.state.prs.push({ ...clone(f.state.prs[0]), number: 2 });
  await f.execute();
  assert.deepEqual(
    f.effects.map(([kind]) => kind),
    ['approve', 'merge', 'rebase']
  );
  assert.equal(f.effects[2][1].issue_number, 2);
  assert.match(f.effects[2][1].body, /merged-base/);
});
test('does not merge outdated CI, missing workflows, failed or running runs, or empty/skipped jobs', async (t) => {
  for (const mutate of [
    (s) => {
      s.runs = [];
    },
    (s) => {
      s.runs[0].head_sha = 'old-head';
    },
    (s) => {
      s.runs[0].conclusion = 'failure';
    },
    (s) => {
      s.runs[0].status = 'in_progress';
    },
    (s) => {
      s.runs[0].head_repository.full_name = 'stranger/consumer';
    },
    (s) => {
      s.runs.push({ ...s.runs[0], conclusion: null, id: 11, status: 'queued' });
    },
    (s) => {
      s.runs.push({ ...s.runs[0], conclusion: 'failure', event: 'pull_request', id: 11 });
    },
    (s) => {
      s.jobs = [];
    },
    (s) => {
      s.jobs[0].conclusion = 'skipped';
    },
    (s) => {
      s.checks = [{ conclusion: null, status: 'in_progress' }];
    },
    (s) => {
      s.status = { state: 'failure', total_count: 1 };
    },
  ])
    await t.test(mutate.toString(), async () => {
      const f = fixture();
      mutate(f.state);
      await f.execute();
      assert.deepEqual(f.effects, []);
    });
});
test('requires every configured CI workflow including lint', async () => {
  const f = fixture();
  await f.execute('linter', ['.github/workflows/build.yml', '.github/workflows/lint.yml']);
  assert.deepEqual(f.effects, []);
});
test('does not act on human/fork/draft/unsigned/edited PRs or executable changes', async (t) => {
  for (const mutate of [
    (s) => {
      s.prs[0].user.login = 'human';
    },
    (s) => {
      s.prs[0].head.repo.full_name = 'stranger/consumer';
    },
    (s) => {
      s.prs[0].draft = true;
    },
    (s) => {
      s.commits[0].commit.verification.verified = false;
    },
    (s) => {
      s.commits[0].author.login = 'human';
    },
    (s) => {
      s.files.push({ filename: 'src/index.js', status: 'modified' });
    },
    (s) => {
      s.files.push({ filename: 'package.json', status: 'added' });
    },
    (s) => {
      s.headLock = lock('new', 'old', 'new');
    },
    (s) => {
      s.reviews = [{ state: 'CHANGES_REQUESTED', user: { login: 'maintainer' } }];
    },
  ])
    await t.test(mutate.toString(), async () => {
      const f = fixture();
      mutate(f.state);
      await f.execute();
      assert.deepEqual(f.effects, []);
    });
});
test('rechecks head and main before approval and again before merging', async (t) => {
  for (const change of ['head', 'base', 'closed']) {
    for (const when of ['before approval', 'after approval'])
      await t.test(`${change}: ${when}`, async () => {
        const mutate = (s) => {
          if (change === 'head') s.prs[0].head.sha = 'new-head';
          if (change === 'base') s.base = 'new-base';
          if (change === 'closed') s.prs[0].state = 'closed';
        };
        const f = fixture(
          when === 'before approval'
            ? {
              onGet: (s, count) => {
                if (count === 2) mutate(s);
              },
            }
            : { onApproval: mutate }
        );
        await f.execute();
        assert.deepEqual(
          f.effects.map(([kind]) => kind),
          when === 'before approval' ? [] : ['approve']
        );
      });
  }
});
test('accepts all upstream dependencies and limits consumers to lint updates', async () => {
  const npm = fixture({ headLock: lock('old', 'old', 'new') });
  await npm.execute('all');
  assert.equal(npm.effects.at(-1)[0], 'merge');
  for (const scope of ['all', 'linter']) {
    const f = fixture({ files: [{ filename: '.github/workflows/build.yml', status: 'modified' }] });
    f.state.prs[0].head.ref = 'dependabot/github_actions/actions/checkout-abc';
    f.state.runs[0].head_branch = f.state.prs[0].head.ref;
    await f.execute(scope);
    assert.deepEqual(
      f.effects.map(([kind]) => kind),
      scope === 'all' ? ['approve', 'merge'] : []
    );
  }
});
test('preserves existing approvals and refuses an implicit empty CI policy', async () => {
  const f = fixture({
    reviews: [{ commit_id: 'tested-head', state: 'APPROVED', user: { login: 'github-actions[bot]' } }],
  });
  await f.execute();
  assert.deepEqual(
    f.effects.map(([kind]) => kind),
    ['merge']
  );
  await assert.rejects(f.execute('all', []), /explicit dependency scope/);
});
