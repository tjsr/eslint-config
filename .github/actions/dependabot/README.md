# Dependabot automation

This action detects open dependency branches behind the default branch and
requests a Dependabot rebase when the token identifies a user with push access. It approves and rebase-merges one eligible PR per run
after every configured CI workflow succeeds on the current PR commit. After a
merge it requests fresh rebases for the other Dependabot PRs, including merges
made with `GITHUB_TOKEN` that do not trigger a separate Actions push run.

`scope: all` accepts npm and GitHub Actions updates in this repository.
`scope: linter` accepts only `@tjsr/eslint-config`, `eslint`, `eslint-*`,
`@eslint/*`, `@typescript-eslint/*`, `typescript-eslint`, `@stylistic/*`,
`prettier`, `prettier-plugin-sort-members`, and
`@trivago/prettier-plugin-sort-imports`.
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
Rebase commands are deduplicated per user and base/head commit pair. If Dependabot
rejects that user's command for lack of push access, the action warns and does not
retry for the same user and head as the base advances. The stale PR remains
ineligible for approval or merge. A maintainer with push access can request
`@dependabot rebase` manually. Conflicts that Dependabot cannot rebase and
repository protection failures also need maintainer help.

The workflows run after CI, on default-branch pushes, every six hours, and on
manual dispatch. They become active when merged into the default branch.
Consumers pin the shared action to a reviewed commit in this repository.

The token needs Actions/checks read and contents/pull-requests/issues write
permissions. GitHub Actions must be allowed to approve pull requests. Repository
rules still apply; native repository auto-merge does not need to be enabled.
The caller uses an existing `TJSR_AUTOMATION_TOKEN` when available, otherwise
`GITHUB_TOKEN`. Issuing rebase commands requires a user-authenticated token
whose repository role permits pushes and whose token permissions allow PR
comments. Callers can pass an existing, authorised credential through the
optional `rebase-token` input; it is not used for approval or merge. Without
this input, the action validates its existing `token`. The default installation
token cannot verify a user identity and will warn rather than post an unusable
command. Merges with `GITHUB_TOKEN` do not start ordinary push workflows,
including deployment workflows. An existing automation token is needed when
those workflows must run after a merge. This change does not provision tokens,
change repository settings, or bypass branch protection.

Run the policy tests with:

```sh
node --test .github/actions/dependabot/automation.test.mjs
```
