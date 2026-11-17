# Dependabot automation

This action requests a Dependabot rebase whenever an open dependency branch is
behind the default branch. It approves and rebase-merges one eligible PR per run
after every configured CI workflow succeeds on the current PR commit. After a
merge it requests fresh rebases for the other Dependabot PRs, including merges
made with `GITHUB_TOKEN` that do not trigger a separate Actions push run.

`scope: all` accepts npm and GitHub Actions updates in this repository.
`scope: linter` accepts only `@tjsr/eslint-config`, `eslint`, `eslint-*`,
`@eslint/*`, `@typescript-eslint/*`, `typescript-eslint`, and `@stylistic/*`.
The linter scope checks changed direct dependencies in the manifest and lockfile,
so updates to the Git commit behind `github:tjsr/eslint-config#main` qualify even
when `package.json` does not change. Mixed groups with other direct dependencies
remain for manual review. npm and CI validate dependency compatibility.

The caller must supply a JSON array of required workflow paths. Missing, pending,
failed, cancelled, or stale CI cannot authorize approval or merge. Runs must have
at least one successful job, and all latest check runs and commit statuses must
also pass. Human change requests block automation. Head and base commits are
checked again before approval and merge; the merge API is given the tested SHA.
Use strict up-to-date branch protection to make GitHub enforce the base-branch
condition atomically if another actor merges in the final API request window.

Only same-repository PRs authored by Dependabot, with verified Dependabot commits,
qualify. The privileged action reads API metadata and JSON files; it never checks
out or executes PR code, downloads PR artifacts, or installs PR dependencies.
Rebase commands are deduplicated for each base/head commit pair. Conflicts that
Dependabot cannot rebase and repository protection failures need maintainer help.

The workflows run after CI, on default-branch pushes, every six hours, and on
manual dispatch. They become active when merged into the default branch.
Consumers pin the shared action to a reviewed commit in this repository.

The token needs Actions/checks read and contents/pull-requests/issues write
permissions. GitHub Actions must be allowed to approve pull requests. Repository
rules still apply; native repository auto-merge does not need to be enabled.
The caller uses an existing `TJSR_AUTOMATION_TOKEN` when available, otherwise
`GITHUB_TOKEN`. Merges with `GITHUB_TOKEN` do not start ordinary push workflows,
including deployment workflows. An existing automation token is needed when
those workflows must run after a merge. This change does not provision tokens,
change repository settings, or bypass branch protection.

Run the policy tests with:

```sh
node --test .github/actions/dependabot/automation.test.mjs
```
