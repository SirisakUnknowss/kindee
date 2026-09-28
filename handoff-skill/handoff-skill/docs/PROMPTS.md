# Portable Prompts

Use these prompts with any AI model.

## Start or resume work

```text
Read handoff-skill/README.md and handoff-skill/handoff.md completely before acting. Verify the recorded state against the current project files. Do not ask me for information already documented there. State the exact resume point, then continue with the first valid Next action unless a genuine decision or permission is missing.
```

## End or pause work

```text
Write handoff. Inspect the work completed in this session and the current project state. Update handoff-skill/handoff.md in place according to handoff-skill/README.md. Record verified status, changed files, decisions with rationale, rejected alternatives, errors and attempted fixes, constraints, validation results, and ordered next actions. Do not include secrets or customer-confidential data. Do not create another handoff file.
```

## Transfer work to another person or model

```text
Prepare this project for transfer. Follow handoff-skill/README.md and update handoff-skill/handoff.md so a person or AI model with no prior conversation can continue immediately. Anything not verified must be marked Not confirmed.
```

## Review the handoff without changing project files

```text
Read handoff-skill/README.md and handoff-skill/handoff.md. Check whether the handoff is complete, internally consistent, free of prohibited sensitive data, and actionable for a new contributor. Report issues only; do not modify project files.
```
