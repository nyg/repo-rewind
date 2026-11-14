# Repo Rewind

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

With a token it uses the GraphQL API and shows everything, private repositories included. Create a [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new) with read-only access to **Contents**, **Metadata** and **Pull requests** for all repositories, then paste it in the account menu.

Signing in with GitHub, when it is [set up](#sign-in-with-github), also uses the GraphQL API. By default it asks for no permissions and shows every public repository with line counts, but no private ones. The visitor can turn on **Include private repositories** before signing in. GitHub has no read-only OAuth scope for private repositories, so this asks for the `repo` scope, which grants read and write access, although the app only reads. Private repositories of an organization also need that organization to approve the OAuth App.

Either way the access token is stored in this browser's `localStorage` and is only sent to `api.github.com`. The production build ships a Content Security Policy that blocks requests to any other host, apart from the sign-in service.

Fetched data is cached in `localStorage`. A refresh only refetches repositories that changed.

## Sign in with GitHub

Sign-in is optional. Without the two build settings below the button stays hidden and only the username and token fields are offered.

GitHub will not hand a token to a browser directly: the last step of its OAuth flow needs a client secret and refuses cross-origin calls. That one step runs in a small Vercel Function in `oauth/`. The site sends it the one-time sign-in code, the function adds the secret and returns the token. It stores nothing.

### 1. Register an OAuth App

On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**. Set both **Homepage URL** and **Authorization callback URL** to the address of the deployed site, for example `https://octocat.github.io/repo-rewind/`.

Note the **Client ID** and generate a **client secret**. The app asks for no scopes unless the visitor chooses to include private repositories, so by default a signed-in visitor grants read access to public data only.

### 2. Deploy the function

Create a Vercel project from this repository with **Root Directory** set to `oauth` and the framework preset **Other**. Add three environment variables:

| Name | Value |
| --- | --- |
| `GITHUB_OAUTH_CLIENT_ID` | the Client ID |
| `GITHUB_OAUTH_CLIENT_SECRET` | the client secret |
| `ALLOWED_ORIGIN` | the origin of the site, for example `https://octocat.github.io` |

The function answers at `https://<project>.vercel.app/api/token` and only to requests coming from `ALLOWED_ORIGIN`.

### 3. Point the site at it

Add two repository variables under **Settings → Secrets and variables → Actions → Variables**, then run the deploy workflow again:

| Name | Value |
| --- | --- |
| `OAUTH_CLIENT_ID` | the Client ID |
| `TOKEN_EXCHANGE_URL` | `https://<project>.vercel.app/api/token` |

For a local build, copy `.env.example` to `.env.local` and fill in the same two values. Sign-in only completes on an address that is both registered as the callback URL in step 1 and allowed by the function's `ALLOWED_ORIGIN`.

## Deploy to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and deploys on every push to the default branch. `.github/workflows/ci.yml` runs the linter, the tests and the build on every pull request. In the repository settings, set **Pages → Source** to **GitHub Actions** once.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Type-check and build into `dist` |
| `pnpm test` | Run the unit tests |
| `pnpm lint` | Run ESLint |
