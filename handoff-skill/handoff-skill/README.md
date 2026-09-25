# Universal Project Handoff

This folder is a model-neutral continuity system for software and documentation projects. It works with Claude, Codex, ChatGPT, Gemini, and other assistants that can read and edit Markdown files.

Keep this entire folder in the root of the project:

```text
project-root/
├── handoff-skill/
│   ├── docs/
│   │   ├── PROMPTS.md
│   │   └── WORKFLOW.md
│   ├── README.md
│   └── handoff.md
└── ...
```

## Required model behavior

Any model working on this project must follow these rules:

1. At the beginning of a work session, read this file and `handoff.md` completely before making changes.
2. Use the repository and current files as the source of truth. If they conflict with `handoff.md`, record the conflict and follow verified current state.
3. Do not ask for information already recorded in `handoff.md`.
4. Before ending a substantive work session, update the same `handoff.md`; never create a dated replacement.
5. Keep the current snapshot at the top and session history in reverse chronological order.
6. Always record material decisions with rationale and rejected alternatives with rejection reasons.
7. Use absolute dates and times with timezone. Never write relative dates such as yesterday or tomorrow.
8. Never guess. Mark unknown or unverified information as `Not confirmed`.
9. Adjust detail to complexity: concise for small tasks and thorough enough to resume complex tasks without questions.

## Commands

These phrases are intentionally model-neutral:

- `read handoff` — Read `README.md` and `handoff.md`, verify current state, state the resume point, and continue.
- `write handoff` — Inspect the work performed, update `handoff.md`, verify all required sections, and report the saved path.

If a model does not recognize the short command, use the full prompts in [docs/PROMPTS.md](docs/PROMPTS.md).

## Confidentiality

Never put these values in any file in this folder:

- passwords, PINs, OTPs, or authentication answers;
- API keys, access tokens, secrets, private keys, or session credentials;
- production connection strings or credentials;
- customer PII;
- confidential or internal customer data.

Use `[REDACTED: type]` and record only a safe retrieval location when necessary.

## Team usage

Commit this folder with the project or place it in the same shared workspace as the project. Every contributor and model reads and updates the same `handoff.md`. Resolve concurrent edits through the team's normal version-control or document-merging workflow.

See [docs/WORKFLOW.md](docs/WORKFLOW.md) for setup and model-specific integration options.
