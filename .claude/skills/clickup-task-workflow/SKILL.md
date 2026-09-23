---
name: clickup-task-workflow
description: Track every piece of KinDee work in ClickUp. Use before starting any task in this repository (feature, fix, doc, design, report, deploy) — find the matching ClickUp task or create one, move it to "in progress", tick off subtasks as they finish, and close it with a summary. Also use when the user asks about project progress, the roadmap, or "what's next".
---

# KinDee ClickUp task workflow

Every unit of work in this repo has a ClickUp task. The user reads ClickUp to know what is happening, so ClickUp must match reality before, during and after the work.

## Where things live

| Thing | ID |
|---|---|
| Workspace | `9003014625` (the account has a second workspace, so always pass `workspace_id`) |
| Space "KinDee" | `90168867568` |
| ✅ 01 · Shipped (Aug–Sep 2026) | list `901617684397` — finished work, subtasks cite commit hashes |
| 🔄 02 · In Progress | list `901617684398` — work happening now |
| 🚀 03 · Launch Readiness | list `901617684399` — gates before public beta (PDPA, billing, QA, ops) |
| 🧭 04 · Roadmap Backlog | list `901617684400` — planned features (P3–P7) |
| Doc "KinDee — Project Handbook" | `8c9y6f1-736` (overview, architecture, timeline, roadmap, runbooks, subscriptions) |

Statuses: `to do` → `planning` → `in progress` → `complete` (also `on hold`, `blocked`, `cancelled`).

## Workflow

### 1. Before writing any code or document

1. Search for an existing task: `clickup_search` / `clickup_filter_tasks` with the list IDs above and keywords from the request. Check subtasks too — the work may already be a subtask of a larger task.
2. **Task exists** → use it. Set it (and the subtask you are starting) to `in progress`.
3. **No task** → create one before starting:
   - Put it in the right list: new work the user asked for now → `🔄 02 · In Progress`; a launch gate → `🚀 03`; future work → `🧭 04`.
   - Parent task = one feature or outcome. Break it into subtasks that each take **≤ 4 hours** (set `time_estimate` in minutes).
   - Design subtasks to be independent. **Do not add dependencies** unless the work truly cannot start without another task — if order matters, say so in the description instead.
   - Description (Thai is fine, the user is Thai): what and why, the files involved, and a checkable **Definition of Done**.
   - Priority: `urgent` only for launch blockers; otherwise `high`/`normal`/`low`.
4. Tell the user which task you picked or created, as a markdown link.

### 2. While working

- When a subtask is finished, set it to `complete` right away — don't batch everything at the end.
- If you find extra work, add a new subtask (still ≤ 4h) instead of silently widening the scope.
- If you're blocked on the user (a secret, a decision, legal sign-off), set the subtask to `blocked` and say why in a comment.

### 3. When done

- Set the parent to `complete` only when every subtask is complete or explicitly `cancelled`.
- Add a comment summarising the outcome: commit hash or PR, files changed, artifact or deploy links, anything left for the user.
- If the work changes the roadmap (a phase finishes, a new risk appears), update the matching page of the Project Handbook doc.

## Rate limit and fallback

The ClickUp MCP allows **100 calls per day**. Budget for it:
- Prefer one search over many single reads; don't re-read tasks you just created.
- For bulk work (more than ~15 tasks), don't loop MCP calls — use the spreadsheet import below.

If the MCP answers `RATE_LIMIT_EXCEEDED`, keep working through ClickUp in the user's browser (Claude in Chrome — they're already signed in):
- **Single task / status / comment**: open the list, then use `+ Add Task`, the status pill or the task's comment box.
- **Bulk create**: Settings → Imports / Exports → Spreadsheet → choose the list → "Manually enter data", then paste TSV.
  - Grid columns, in order: Task Name, Task ID, Subtask IDs, Description content, Task assignee, Status, Due Date, Start Date, Date Created, Priority, Tags, Time Estimate.
  - Give each row a temporary ID (e.g. `KD-001`). A parent lists its children in `Subtask IDs`, comma-separated.
  - Priority must be capitalised: `Urgent` / `High` / `Normal` / `Low`. Estimates look like `1h 30m`.
  - The upload button lives in a cross-origin iframe you can't reach. Put the TSV in a temporary `<textarea>`, select it, send a real `ctrl+c`, click the first Task Name cell, then `ctrl+v`. (`navigator.clipboard.writeText` hangs.)
  - After a paste, rows stay "Invalid" until their values actually change. Paste a placeholder column (for example all `Urgent`), then paste the real column; "Import into ClickUp" becomes enabled.
  - Stay on the page until the import shows as started, then check the list.
- **Attach existing tasks to a parent**: in list view, tick the tasks, then choose bulk toolbar → "Convert to Subtasks" → pick the parent. Reload to confirm the change persisted.
- Deleting from the UI moves items to ClickUp Trash. Only delete when the user asks.

When the MCP comes back, check that anything done in the browser is reflected correctly.

## Conventions

- Task names: short English imperative ("Add sync-failed state"). Parents that record finished work start with `[Shipped]`.
- Reference ClickUp tasks in replies as `[Task name](https://app.clickup.com/t/<id>)` — never bare URLs.
- Don't create due dates or assignees unless the user asks.
- Never paste secrets, tokens or personal data into task descriptions or comments.
