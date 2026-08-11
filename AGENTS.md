# LeagueLore Import Helper Agent Guide

This guide defines how agents should plan, implement, validate, and hand off changes in this
repository.

## Project Layout

- `apps/desktop/`: Electron, React, and Vite desktop application.
  - `src/main/`: Electron lifecycle, ESPN access, validation, upload, diagnostics, and security.
  - `src/preload/`: restricted renderer bridge.
  - `src/renderer/`: user interface and import review.
  - `src/shared/`: shared IPC and input contracts.
- `packages/import-contract/`: versioned TypeScript and Zod import contract.
- `docs/`: privacy, security, and release guidance.
- `scripts/`: maintenance, release, and production smoke-test scripts.

## Working Principles

- Choose the simplest implementation that fully meets the current requirements.
- Follow nearby repository patterns before adding an abstraction or dependency.
- Keep changes scoped. Preserve unrelated and pre-existing worktree changes.
- Treat code, tests, and executable configuration as the source of truth. Update supporting
  documentation when behavior changes.
- Keep the helper aligned with LeagueLore's import-helper API, deep-link contract, canonical portal
  origin, shared import schema, privacy statements, and user-facing terms.
- Preserve compatibility unless a coordinated, versioned contract change explicitly permits a
  breaking change.

### Writing Standard

- Always use Simplified Technical English (ASD-STE100) as a practical guide for user-facing copy,
  documentation, comments, release notes, and agent handoffs. Apply its plain-language methods; do
  not claim formal ASD-STE100 conformance.
- Follow William Zinsser's four principles of quality writing:
  1. **Simplicity**: Use familiar, specific words. Give one term one meaning and keep one main idea
     in each sentence.
  2. **Brevity**: Cut filler, repetition, throat-clearing, and words that do not help the reader act
     or understand.
  3. **Clarity**: Prefer active voice. Lead with the outcome or next action. Say what happened, why
     it matters, and what the reader can do next.
  4. **Humanity**: Sound warm, direct, and knowledgeable without becoming cute, mechanical, or
     promotional.
- Prefer short sentences and paragraphs. Keep legal, security, privacy, accessibility, Electron,
  ESPN, and LeagueLore terms when they protect accuracy or trust.
- Do not expose internal terms such as "payload," "normalization," "contract," or "persistence" in
  product copy unless the user needs them. Prefer "league data," "import file," "file format," and
  "save."
- Avoid vague marketing words such as "seamless," "robust," "powerful," "unlock," "leverage," and
  "streamline."
- Errors and empty states must explain the problem and the next step. Buttons must name the action.
- When product copy changes, update exact-text tests and related documentation in the same change.
  Read the final text as a user would before handing it off.

### Security and Privacy Rules

- Never read browser cookie stores. Use only the helper's isolated, non-persistent ESPN session.
- Never upload or log ESPN passwords, cookies, LeagueLore import tokens, raw headers, or raw ESPN
  responses.
- Keep short-lived import tokens out of saved settings and diagnostics.
- Packaged uploads and continuation links must use the canonical LeagueLore portal origin.
- Validate all renderer-to-main IPC input at the main-process boundary.
- Keep Electron isolation, sandboxing, navigation restrictions, Content Security Policy, fuses,
  ASAR integrity, and permission denial intact unless a reviewed security change requires otherwise.
- Treat release signing, notarization, checksums, and explicit unsigned-Windows warnings as part of
  the security boundary.

## Code and Validation Standards

- Use TypeScript strictness and existing Electron, React, Vite, Vitest, ESLint, and Prettier
  patterns.
- Keep ESPN response parsing in `apps/desktop/src/main/espn/transform.ts` and shared import types in
  `packages/import-contract/`.
- Update the import contract version deliberately when a breaking schema change is required.
- Add tests for security boundaries, input validation, data transformation, failure handling, and
  regressions that could realistically recur.
- Run the smallest relevant test first, then run the full quality suite for completed changes:

```bash
npm run lint
npm run format:check
npm test
npm run typecheck
npm run build
npm run quality
```

## Git and Handoff

- Do not commit, push, publish a release, or modify remote state unless the user asks.
- Use Conventional Commits when a commit is requested.
- Finish with the implementation outcome, verification results, and any cross-repository follow-up.
