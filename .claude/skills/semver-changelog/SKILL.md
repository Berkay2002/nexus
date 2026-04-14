---
name: semver-changelog
description: Automate CHANGELOG.md updates AND semver git tagging from commit history. Use when you need to summarize changes between HEAD and the latest tag, cut a new version tag (one or more), initialize a changelog, or retroactively backfill one. Handles the split decision when a range of commits covers multiple themes.
---

# Semver Changelog

This skill guides the agent through identifying released versions, analyzing
git history, documenting changes in `CHANGELOG.md`, **and creating the
corresponding semver git tags**.

## Overview

A consistent changelog + tag history helps users and contributors understand
what has shipped. This skill produces entries that follow
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) with project-specific
conventions baked in (see "Conventions" below), and uses
[Semantic Versioning](https://semver.org/) for version numbers.

**Default assumption: the skill ends by creating one or more annotated git
tags.** Stashing changes under `[Unreleased]` without tagging is only the
right move when the user explicitly asks for it, or when a release clearly
isn't ready.

## Three Workflows

**1. Cut release (default).** A batch of commits has accumulated since the
last tag. Decide whether to split into multiple versions, update the
CHANGELOG, and create the tags.

**2. Stage into Unreleased (opt-in).** The user explicitly wants to defer
tagging — accumulate notes under `[Unreleased]` and skip tag creation.

**3. Retroactive backfill (rare).** The project already has multiple tags
but no CHANGELOG — typically on first adoption. Walk each tag delta in order
and write one version entry per tag. No new tags created.

Pick which mode you're in before you start. If the user just says
`/semver-changelog`, assume mode 1 (cut release). If in doubt, ask.

## Conventions

Every CHANGELOG this skill writes follows these rules:

1. **Three categories only:** `### Added`, `### Changed`, `### Fixed`. Omit
   empty sections. Fold any "Removed" / "Deprecated" / "Security" items into
   `### Changed` unless the project has a standing reason to track them
   separately. Most pre-1.0 projects don't.

2. **Curated, user-visible bullets.** 4–8 bullets per section. Collapse or
   omit:
   - `ingest:` / `lint:` knowledge-base commits (summarize as one line if
     they define the milestone; otherwise omit)
   - `chore:` dependency bumps unless they're the point of the release
   - `docs:` commits unless the docs change is user-facing
   - Typo/format commits
   - Meta commits about the changelog/skill itself (`docs: add CHANGELOG.md`,
     `docs(semver-changelog): ...`)
   If the raw commit log has 40 entries but only 6 are user-visible, the
   version entry has 6 bullets, not 40.

3. **Version header format:**
   ```
   ## [X.Y.Z] — YYYY-MM-DD — Short theme line
   ```
   Followed by a 1–2 sentence prose theme paragraph, then the `### Added` /
   `### Changed` / `### Fixed` sections.

4. **Newest-first order.** `[Unreleased]` at the top, then most recent tag,
   down to the oldest.

5. **Compare URL footer.** Always include. At the bottom of the file:
   ```
   [Unreleased]: https://github.com/OWNER/REPO/compare/vLATEST...HEAD
   [LATEST]: https://github.com/OWNER/REPO/compare/vPREVIOUS...vLATEST
   ...
   [FIRST]: https://github.com/OWNER/REPO/releases/tag/vFIRST
   ```
   Derive `OWNER/REPO` from `git remote get-url origin`.

## Workflow: Cut Release

### 1. Identify the latest released tag
```
git tag -l --sort=-v:refname
```
Filter for `v?MAJOR.MINOR.PATCH`. The first result is the latest.

### 2. Analyze changes
```
git log <latest_tag>..HEAD --format='%h %ai %s' --reverse
```
Chronological order — dates matter for the split decision. For ambiguous
changes, read the actual commit or diff.

### 3. Decide on the version split

Walk the commit log and ask: **is this one release or multiple?**

**One tag if:**
- The work has a single dominant theme
- Fewer than ~10 user-visible commits
- All commits touch a narrow subsystem

**Multiple tags if:**
- You can identify 2+ thematically distinct chunks (different subsystems,
  different work streams) with a clean boundary in the log
- Each chunk has enough user-visible content to stand alone (≥3 bullets)
- The project already tags same-day multi-version releases — check with
  `git tag -l --sort=v:refname` and read recent tag dates via
  `git log --tags --simplify-by-decoration --format='%ci %d'`. If prior
  versions share dates, same-day splits are in-pattern.

For each chunk, identify **the last commit belonging to that theme** — that's
the commit the tag will point at. Tags anchor on the real feature commit,
not a downstream changelog commit.

Present the split plan to the user briefly (1–2 sentences per proposed
version) before tagging. Unless they object, proceed.

### 4. Pick the version numbers

Pre-1.0 bump rules (most small projects):
- **PATCH** (0.x.Y → 0.x.Y+1) — bug fixes only, no new capabilities
- **MINOR** (0.X.y → 0.(X+1).0) — new features, new user-visible capability
- **MAJOR** — reserved for the 1.0 release

Post-1.0: standard semver — breaking changes bump major, features bump minor.

See `references/semver_reference.md` for detail.

### 5. Curate bullets

Apply the "Conventions" rules. Classify each user-visible change as
Added / Changed / Fixed. Draft a 1–2 sentence theme paragraph per version.

### 6. Update CHANGELOG.md
- If the file doesn't exist, create it with the minimal header:
  ```
  # Changelog

  All notable changes to <Project> will be documented here.
  Format based on Keep a Changelog; project uses semver while pre-1.0.

  ## [Unreleased]
  ```
- Insert the new version section(s) immediately under `[Unreleased]`, newest
  first, each dated today (or the last commit date in the chunk).
- Leave `[Unreleased]` as an empty header at the top — it's the staging area
  for future work.
- Update the compare URL footer: add every new version, update the
  `[Unreleased]` link to point at the newest tag.

### 7. Create annotated tags

```
git tag -a vX.Y.Z <commit-sha> -m "vX.Y.Z — Theme line

Short prose description (1–2 sentences)."
```

Rules:
- **Always annotated** (`-a`). Lightweight tags lose theme, author, and date.
- **Point at the feature commit**, not HEAD, unless HEAD is the last feature
  commit in the last chunk. For a split release, earlier tags may not sit
  on the current branch tip — that's fine.
- **Never push tags unless the user explicitly asks.** Tell them the tags
  are local and how to push: `git push origin vX.Y.Z [vX.Y.Z ...]`.
- **Do not commit the CHANGELOG update automatically.** Leave it unstaged so
  the user can tweak wording before committing. This decouples tag creation
  from changelog edits.

### 8. Verify

```
git tag -l --sort=-v:refname | head -10
git show <new-tag> --stat
```

Confirm tags exist, are annotated, and point at the intended commits.

Report to the user: which tags were created, which commits they point at,
that the tags are **local only**, and that the CHANGELOG edit is **unstaged**.

## Workflow: Stage into Unreleased

Same as "Cut Release" through step 5, but:
- Accumulate the curated bullets under `[Unreleased]`
- Do not create new version sections, tags, or footer entries

## Workflow: Retroactive Backfill

1. Confirm with the user that this is a backfill — multiple tags exist and
   no CHANGELOG is present.
2. List tags in chronological order: `git tag -l --sort=v:refname`
3. For each tag, read its annotated message:
   `git for-each-ref --format='%(refname:short) %(contents)' refs/tags/`
   If tag messages are lightweight, fall back to `git log <prev_tag>..<tag>`
   and curate from subjects.
4. Write all version entries newest-first, following the Conventions above.
5. Add the full compare URL footer for every tag.
6. No new tags are created in this workflow.

## Guidelines

- Refer to `references/semver_reference.md` for detailed formatting and
  versioning rules.
- Always check the repository root for an existing `CHANGELOG.md` before
  creating a new one.
- Always use `[Unreleased]` as a staging area between tags.
- When unsure whether a commit is "user-visible," ask: would a contributor
  scanning the changelog care about this line? If no, cut it.
- **Never push tags without explicit user instruction.** Tag creation is
  reversible (`git tag -d vX.Y.Z`); pushing isn't.
- **Never auto-commit the CHANGELOG.** The user may want to adjust wording.
- If you're cutting a release and the current branch is dirty in ways
  unrelated to CHANGELOG.md, surface it before tagging — tags capture the
  state of the commit they point at, not the working tree, but a dirty tree
  usually means there's context you're missing.

## Validation

After running the skill, verify:

1. **File exists** at the repository root.
2. **Header present** — the three-line preamble above the first `[Unreleased]`.
3. **Section order** — `[Unreleased]` first, then versions newest-first.
4. **Categories** — every version uses only `### Added` / `### Changed` /
   `### Fixed`; empty sections are omitted.
5. **Theme line** — every version header has the `— YYYY-MM-DD — Theme` form
   and a short prose theme paragraph beneath it.
6. **Compare URLs** — footer covers `[Unreleased]` and every version; the
   oldest version points at `releases/tag/vX.Y.Z` instead of a compare URL.
7. **SemVer** — version numbers follow `MAJOR.MINOR.PATCH`.
8. **Tags created** (cut-release mode) — `git tag -l` shows every new
   version as an **annotated** tag pointing at the intended commit.
9. **Tags still local** — unless the user asked to push. Final message
   states explicitly what's local vs. remote and the push command.
10. **CHANGELOG still unstaged** — unless the user asked to commit it.

## Example Version Entry

```markdown
## [0.6.0] — 2026-04-10 — Provider-agnostic model registry

Tiered, provider-agnostic model resolution across Google, Anthropic, and
OpenAI with UI overrides.

### Added
- Tier registry (`classifier` / `default` / `code` / `deep-research` / `image`)
  with auto-detected providers
- Per-role overrides via `configurable.models` and runtime middleware
- Web model settings panel and `/api/models` route

### Changed
- Migrated from `@langchain/google-genai` to `@langchain/google` via
  `createGoogleModel`

### Fixed
- Preflight fails fast when the default tier has no provider configured
```

## Example Tag Creation

```
git tag -a v0.11.0 aafd469 -m "v0.11.0 — Meta-router visualization & OpenAI Responses API

Routing card in the web UI, OpenAI Responses API support in the meta-router,
and provider identity across sub-agents."
```

Note the tag points at `aafd469` (the last feature commit in the chunk), not
`HEAD`. The v0.12.0 tag points at a later commit — tags for a split release
don't need to form a linear chain to HEAD.
