@AGENTS.md

# Claude Code only

Everything shared with other agents is in `AGENTS.md` (imported above). This file holds what applies to Claude Code alone.

> **Personal context:** John keeps a dated personal-context doc (background, constraints, review priorities as the builder — not this repo's rules) in Google Drive: https://drive.google.com/drive/folders/1cjNFhY6ZnN5xB4PSDhz7FA24KGl92NTy — titles are date-stamped (`Personal_Context_YYYY-MM-DD.md`). At session start, or when asked to review this repo "against what you know about me," use the Google Drive tools to find the **most recently dated** file there (don't assume a filename) and weigh suggestions against it. Nothing is committed to this repo for this.

> **Response style (this session, in this repo — not app UI behavior):** when answering a question or giving a conclusion/analysis, prefer publishing it as a visual artifact before the full text explanation. A long or multi-part answer leads with the artifact and a short pointer in chat; a short answer (a few sentences) can just be said directly.

- **Skills load themselves** when matching files are touched; read the `SKILL.md` directly if one doesn't fire. For UI work, also follow the `frontend-design` skill.
- **Merging — standing permission (granted 2026-10-02).** Claude Code merges its own PRs to `main` once CI and the Vercel preview are green, without asking. Two exceptions still stop and ask: (1) any PR adding a file under `neon/migrations/`; (2) a visual/layout change Claude Code couldn't view rendered. `main` deploys to production — never merge through a red or still-building check.
