---
name: semver-changelog
description: Automate the creation and updating of a CHANGELOG.md file based on Semantic Versioning (SemVer) and "Keep a Changelog" principles. Use this skill when you need to summarize changes between the current HEAD and the latest git tag, or when initializing a new changelog for a project.
---

# Semver Changelog

This skill guides the agent through identifying released versions, analyzing
git history, and documenting changes in the project's CHANGELOG.md format.

## Overview

A consistent changelog helps users and contributors understand what has
changed between versions. This skill produces entries that follow
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) with project-specific
conventions baked in (see "Conventions" below), and uses
[Semantic Versioning](https://semver.org/) for version numbers.

## Two Workflows

**1. Incremental update (default).** Most runs. A new tag has just been cut,
or changes have accumulated under `[Unreleased]` and need to be categorized.
Walk one tag delta (`previous_tag..current_tag` or `latest_tag..HEAD`).

**2. Retroactive backfill (rare).** The project already has multiple tags
but no CHANGELOG — typically on first adoption. Walk each tag delta in order
(`v0.1.0` → `v0.2.0` → … → `HEAD`) and write one version entry per tag. Use
annotated tag messages (`git tag -n99`) as the source when they exist; they're
curated and beat parsing raw commit subjects.

Pick which mode you're in before you start. If in doubt, ask the user.

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

## Workflow: Incremental Update

### 1. Identify the latest released tag
```
git tag -l --sort=-v:refname
```
Filter for `v?MAJOR.MINOR.PATCH`. The first result is the latest tag.

### 2. Analyze changes
```
git log <latest_tag>..HEAD --format='%h %s'
```
Read the full commit log into context. For ambiguous changes, read the
actual commit or diff.

### 3. Curate bullets
Apply the "Conventions" rules above. Classify each user-visible change as
Added / Changed / Fixed. Draft a 1–2 sentence theme paragraph that captures
what this version is *about*.

### 4. Update CHANGELOG.md
- If the file doesn't exist, create it with the minimal header:
  ```
  # Changelog

  All notable changes to <Project> will be documented here.
  Format based on Keep a Changelog; project uses semver while pre-1.0.

  ## [Unreleased]
  ```
- Move the contents of `[Unreleased]` into a new version section dated today
  (or the tag's commit date, if already tagged).
- Update the compare URL footer: add the new version, update the
  `[Unreleased]` link to point at the new tag.

## Workflow: Retroactive Backfill

1. Confirm with the user that this is a backfill — multiple tags exist and
   no CHANGELOG is present.
2. List tags in chronological order:
   `git tag -l --sort=v:refname`
3. For each tag, read its annotated message:
   `git for-each-ref --format='%(refname:short) %(contents)' refs/tags/`
   If tag messages are lightweight (no body), fall back to
   `git log <prev_tag>..<tag>` and curate from subjects.
4. Write all version entries newest-first, following the Conventions above.
5. Add the full compare URL footer for every tag.

## Guidelines

- Refer to [references/semver_reference.md](references/semver_reference.md)
  for detailed formatting and versioning rules.
- Always check the repository root for an existing `CHANGELOG.md` before
  creating a new one.
- Always use `[Unreleased]` as a staging area between tags.
- When unsure whether a commit is "user-visible," ask: would a contributor
  scanning the changelog to understand what shipped care about this line? If
  no, cut it.

## Validation

After updating or creating the changelog, verify:

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
