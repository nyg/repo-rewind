# Repo Activity

A dashboard that ranks your GitHub repositories by how active they are, and lets you drag a date slider to see what you were working on at any point in the last year.

It is a static site: React, Vite, Tailwind CSS and shadcn/ui. The browser talks to the GitHub API directly, so there is no backend.

## What it shows

- Every repository you own, ranked by an activity score on the selected date.
- Per repository and per week: commits, lines added and removed, pull requests merged.
- A timeline of all commits. Click a week, drag the handle, or replay the year to watch the ranking change.
- A detail panel per repository with the score over time, pull requests opened and merged, and a table view.

## Activity score

Every event adds points on the day it happens, and points fade with a half-life of 7, 14 or 30 days.

| Event | Points |
| --- | --- |
| Commit on the default branch | 1 to 2, growing with the size of the diff and capped at 1,000 changed lines |
| Pull request opened | 1 |
| Pull request merged | 1 |

The "Work by" filter chooses whose events count: you, AI agents (Copilot, Claude, Codex…), automation (Renovate, Dependabot, GitHub Actions…) or other people. In forks only the owner's commits are fetched.

## Run it

```bash
pnpm install
```

```bash
pnpm dev
```

## GitHub access

Without a token the app reads public data only: the 12 most recently pushed public repositories, without line counts, within GitHub's limit of 60 anonymous requests per hour.

With a token it uses the GraphQL API and shows everything, private repositories included. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with read-only access to **Contents**, **Metadata** and **Pull requests** for all repositories, then paste it in the account menu. The token is stored in this browser's `localStorage` and is only sent to `api.github.com`. The production build ships a Content Security Policy that blocks requests to any other host.

Fetched data is cached in `localStorage`. A refresh only refetches repositories that changed.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to the default branch. In the repository settings, set **Pages → Source** to **GitHub Actions** once.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build into `dist` |
| `pnpm test` | Run the unit tests |
| `pnpm lint` | Run ESLint |
