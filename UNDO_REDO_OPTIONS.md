# Undo/Redo Sync Options

Context
- Current undo/redo lives only in local client state (useProjectState) and does not guarantee server consistency.
- Goal: evaluate future approaches to support undo/redo across project tabs with optional server sync.

Option A: Action log + inverse operations (event-sourcing light)
- Store each user action with enough data to compute the inverse operation.
- Undo runs the inverse API call(s); redo replays the original action.
Pros
- True undo/redo across sessions and devices.
- Works well with audit/history features.
Cons
- Highest complexity; each action needs a defined inverse.
- Needs careful ordering for dependent entities.
- More backend work (schema, APIs, validations).

Option B: Soft delete + restore
- Replace hard delete with a deletedAt flag for key entities.
- Undo on deletions becomes restore instead of recreate.
Pros
- Simple and reliable for deletions.
- Preserves IDs and relationships.
Cons
- Requires schema changes and UI handling for hidden items.
- Does not solve undo for edits unless combined with other methods.

Option C: Local undo + server sync on undo/redo (hybrid)
- Keep local undo/redo history as today.
- On undo/redo, trigger API calls to align server state.
Pros
- Lower effort than full action log.
- Preserves current UX with incremental backend changes.
Cons
- Conflict risk if server data changed by another user.
- Some actions require re-creation with stable IDs.
- May need background retry and error states ("local changes not synced").

Option D: Snapshot-based sync per module
- Store periodic snapshots (or patch lists) for specific modules (e.g., expenses, planning).
- Undo/redo replays snapshot diffs or swaps whole module state.
Pros
- Easier to implement per module.
- Good for batch edits/imports.
Cons
- Larger payloads; can be expensive with big datasets.
- Not granular for single item changes.

Implementation notes
- IDs: undoing a delete requires stable IDs or server support to accept client-provided IDs.
- Ordering: tree data (WBS, expenses) must apply updates in parent-before-child order.
- Concurrency: consider optimistic conflict detection (updatedAt/version) and user warnings.
- UX: show sync status for undo/redo actions (success, pending, failed).

Suggested rollout
1) Pilot with Expenses or WBS (most frequent edits).
2) Add soft delete for key entities to simplify undo on deletions.
3) Expand to planning, workforce, assets, documents.

Open questions
- Should undo/redo be per user/session only or shared across roles?
- Are we OK with best-effort sync or must it be consistent?
- Which modules are highest priority for reliable undo?
