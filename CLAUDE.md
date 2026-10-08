@AGENTS.md

# Claude Code only

Everything shared with other agents is in `AGENTS.md` (imported above). This file holds what applies to Claude Code alone.

> **Personal context:** John keeps a dated personal-context doc (background, constraints, review priorities as the builder — not this repo's rules) in Google Drive: https://drive.google.com/drive/folders/1cjNFhY6ZnN5xB4PSDhz7FA24KGl92NTy — titles are date-stamped (`Personal_Context_YYYY-MM-DD.md`). At session start, or when asked to review this repo "against what you know about me," use the Google Drive tools to find the **most recently dated** file there (don't assume a filename) and weigh suggestions against it. Nothing is committed to this repo for this.

> **Response style (this session, in this repo — not app UI behavior):** when answering a question or giving a conclusion/analysis, prefer publishing it as a visual artifact before the full text explanation. A long or multi-part answer leads with the artifact and a short pointer in chat; a short answer (a few sentences) can just be said directly.

- **Skills load themselves** when matching files are touched; read the `SKILL.md` directly if one doesn't fire. For UI work, also follow the `frontend-design` skill.

## Subagent routing

Follow "Subagent models" in `~/.claude/CLAUDE.md`: Haiku for searches, sweeps and mechanical edits, Sonnet for implementation and reviews, Opus for planning and final review.

## Git workflow (set by John, 2026-10-03)

- Commit finished work to **local `main`**. A short-lived local branch merged into local `main` is fine.
- **Never push to GitHub or open a PR on your own.** Push a branch or open a PR only when John explicitly asks for that push in the conversation. Approving a fix is not approving a push.
- This overrides any older standing permission to push, open PRs or merge.

### Sync with GitHub at session start

A scheduled job refactors this repo every morning and commits straight to `main` on GitHub, so local `main` can fall behind or diverge.

1. First thing each session, run `git fetch origin` and compare local `main` with `origin/main`.
2. Behind only: fast-forward (`git merge --ff-only origin/main`).
3. Diverged: rebase local-only commits onto `origin/main`. If the local commits are already on GitHub as a squash (`git diff main origin/main` is empty), `git reset --hard origin/main` is safe. If the content differs or the rebase conflicts in a way that changes behavior, stop and ask John.
4. Tell John in one line what the fetch found, then continue.
5. Do the same before handing Codex or Antigravity a task: their copies sync from local `main`, so local `main` must be current first.
