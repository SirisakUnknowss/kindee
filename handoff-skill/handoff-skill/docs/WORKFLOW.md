# Workflow and Model Integration

## Standard workflow

1. Copy the complete `handoff-skill/` folder to the project root.
2. Replace placeholder values in `handoff.md` with verified project facts.
3. Commit or share the folder with the project.
4. Start each session with `read handoff`.
5. End each substantive session with `write handoff`.
6. Review changes to `handoff.md` alongside code or document changes.

## Claude

Claude can use the portable prompts without any extra file. At session start, ask it to read:

```text
handoff-skill/README.md
handoff-skill/handoff.md
```

For automatic project guidance, add a short instruction to the project's existing `CLAUDE.md`:

```markdown
Before project work, read handoff-skill/README.md and handoff-skill/handoff.md.
Before ending substantive work, update handoff-skill/handoff.md according to its README.
```

Do not create `CLAUDE.md` if the project already manages Claude instructions elsewhere without checking the existing convention.

## Codex

Codex can use the portable prompts without any extra file. At session start, say:

```text
read handoff
```

For automatic project guidance, add a short instruction to the relevant scoped `AGENTS.md`:

```markdown
Before project work, read handoff-skill/README.md and handoff-skill/handoff.md.
Before ending substantive work, update handoff-skill/handoff.md according to its README.
```

Respect existing `AGENTS.md` scope and instructions; do not overwrite them.

## ChatGPT, Gemini, and other models

Attach or expose the project folder to the model, then paste a prompt from `PROMPTS.md`. The system does not depend on a vendor-specific Skill feature.

## Concurrent edits

Only one contributor should finalize `handoff.md` at a time. If branches diverge, merge facts rather than choosing a file wholesale:

- keep the newest verified current snapshot;
- retain relevant decisions and their rationale;
- retain rejected alternatives;
- preserve distinct session entries;
- resolve contradictory status against current project files;
- mark unresolved conflicts `Not confirmed`.
