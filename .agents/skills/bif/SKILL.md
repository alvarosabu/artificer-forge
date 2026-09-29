---
name: bif
description: Use when the user wants to capture an idea or task into the project backlog before it's forgotten — /bif, "before I forget", "add to backlog", "note this down", "don't let me forget"
---

# bif — Backlog capture

One idea = one file in `.claude/backlog/` (repo root). Capture context refs (files, plan lines, decisions) while the conversation still has them — that's the whole point.

## Steps

1. **Idea:** from args; if none, the most recent idea discussed in conversation. If genuinely ambiguous, ask.
2. **Dedup:** `grep -ril '<key terms>' .claude/backlog/` — if a task already covers it, enrich that file instead of creating a new one.
3. **Next ID:** highest existing `AF-\d+` in `.claude/backlog/` + 1, zero-padded to 3 digits.
4. **Write** `.claude/backlog/AF-XXX-short-slug.md`:

```md
---
id: AF-XXX
title: Imperative, feature-level title
area: surfaces | combat | status-effects | architecture | dialog | ...
added: YYYY-MM-DD   # via `date +%F`
status: todo
blocks: []          # AF ids this task unblocks when done
blocked-by: []      # AF ids that must land first
---

2–6 lines: why it matters, refs to files/plans from the conversation,
open decisions. Enough context to start cold weeks later.
```

5. **Inverse links:** if `blocks`/`blocked-by` is set, update the opposite field in each linked task's file in the same edit session. Both directions must always agree.
6. **Confirm** in one line: `AF-XXX captured — <title>`.

## Rules

- Task scope is feature-level ("Implement Poisoned status including damage"); sub-steps become bullets in the body.
- IDs and files are permanent: close a task by flipping `status:` to `done` or `dropped`.
- Work already tracked in an active `.claude/plans/` roadmap gets a link to that plan, not a second tracker.
