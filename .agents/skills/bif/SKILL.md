---
name: bif
description: Use when the user wants to capture an idea or task into the backlog before it's forgotten — /bif, "before I forget", "add to backlog", "note this down", "don't let me forget"
---

# bif — Backlog capture

Capture context refs (files, plan lines, decisions) while the conversation still has them — that's the whole point.

## Steps

1. **Idea:** from args; if none, the most recent idea discussed in conversation. If genuinely ambiguous, ask.
2. **Route** by where the work lands:
   - **Portfolio game** (`apps/game`, its content and assets) → [Linear issue](#linear-issue).
   - **Everything else** (engine, playground, other packages, tooling) → [local file](#local-file).
   - Engine work that the game needs is still engine work: local file. Ask only when the target is truly unclear.

## Linear issue

1. **Dedup:** `list_issues` with key terms and `includeArchived: true`. If an issue already covers it, enrich that issue instead of creating a new one.
2. **Create** with `save_issue`: team `Alvarosabu`, project `Portfolio game`, assignee `me`, one label from `Feature` / `Bug` / `Improvement`. Leave status at the team default. Link related ALV issues with `relatedTo` / `blockedBy`.
3. **Body** follows ALV-13's shape, written for a human in short sentences:
   - One-paragraph summary.
   - `## Design`, `## Behavior`, `## Open decisions`, `## Done when` (drop a section that has nothing).
   - File paths, clip names and other implementation detail go in a closing `+++ Agent notes` … `+++` block.
4. **Images:** `prepare_file_upload`, then PUT the file at once (the signed URL expires in 60 s, send its headers verbatim), then embed the returned markdown.
5. **Confirm** in one line: `ALV-XX captured — <title>` + issue URL.

## Local file

One idea = one file in `.claude/backlog/` (repo root).

1. **Dedup:** `grep -ril '<key terms>' .claude/backlog/` — if a task already covers it, enrich that file instead of creating a new one.
2. **Next ID:** highest existing `AF-\d+` in `.claude/backlog/` + 1, zero-padded to 3 digits.
3. **Write** `.claude/backlog/AF-XXX-short-slug.md`:

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

4. **Inverse links:** if `blocks`/`blocked-by` is set, update the opposite field in each linked task's file in the same edit session. Both directions must always agree.
5. **Confirm** in one line: `AF-XXX captured — <title>`.

## Rules

- Task scope is feature-level ("Implement Poisoned status including damage"); sub-steps become bullets in the body.
- AF IDs and files are permanent: close a task by flipping `status:` to `done` or `dropped`. When a task moves to Linear, set `dropped` and put the ALV link as the first body line.
- Work already tracked in an active `.claude/plans/` roadmap gets a link to that plan, not a second tracker.
