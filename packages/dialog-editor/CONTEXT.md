# Dialog Editor

The Nuxt module that authors dialog trees visually and writes back the same YAML the Engine's dialog engine reads. Conversation vocabulary (tree, node, choice, check, flag, condition, effect, camera shot) is shared with the Engine; everything about the canvas, layout and diagnostics is editor-only.

## Language

### Conversation (shared with the Engine)

**Dialog tree**:
One whole authored conversation: a flat map of nodes plus the start node id. One tree per YAML file, identified by `dialogId`, never by filename.
_Avoid_: dialog graph, dialogue, conversation, script

**Dialog node**:
One beat of a conversation: an optional speaker, the text, on-entry effects, a camera shot and its choices. Bare "node" in this package means this.
_Avoid_: card, line, beat, step

**Choice**:
One player-selectable option leaving a node, with conditions, an optional check and a target.
_Avoid_: option, answer, reply, branch

**Check**:
A tabletop skill roll that gates a choice. A checked choice has an on-success and an on-failure target instead of one next node.
_Avoid_: skill check, roll, test

**Flag**:
A named value of world state that conditions read and effects write. The editor harvests every flag name across all trees for autocomplete.
_Avoid_: variable, state key, switch

**Condition**:
A single-key rule a choice must pass to be available, such as `flag`, `hasItem` or `stat`.
_Avoid_: predicate, requirement, guard

**Effect**:
A single-key game-state change applied when a node is entered or a choice taken, such as `setFlag` or `giveItem`. Unrelated to post-processing effects and status effects.
_Avoid_: action, mutation, consequence

**End**:
The synthetic target that closes the dialog. It is never stored as a node but is always drawn on the canvas as a drop target.
_Avoid_: terminal, exit node, close

**Camera shot**:
The named cinematic framing a node asks for, one of five presets read by the Engine's camera director.
_Avoid_: shot preset, camera preset, framing

### Canvas (editor only)

**Graph**:
The Vue Flow projection of a tree: one graph node per dialog node plus the end, and one edge per wired choice target. The tree is what is saved; the graph is what is drawn.
_Avoid_: canvas (for the data), flow, diagram

**Edge kind**:
The semantic class of an edge derived from the choice field that drives it: plain, success, failure or end.
_Avoid_: edge type, link style

**Handle**:
The connector on a graph node that maps to exactly one choice target field. A collapsed card shows one bundle handle for all choices.
_Avoid_: port, socket, anchor

**Layout**:
Editor-only node positions saved beside the YAML as a sidecar JSON. The runtime never reads it; unplaced nodes fall back to an automatic layout.
_Avoid_: positions, sidecar, arrangement

**Diagnostic**:
An advisory tree-health finding: broken link, unreachable node, dead end or missing start. It never blocks saving.
_Avoid_: issue, validation error, lint, warning

**Dirty**:
The state where the in-memory tree differs from the file. Saving is explicit and rewrites the YAML from scratch; layout saves do not touch it.
_Avoid_: unsaved, modified, changed

### Gestures

**Spawn**:
Creating a new node already wired from a chosen handle.
_Avoid_: add connected, create child

**Splice**:
Inserting a node into an existing edge so A to B becomes A to C to B.
_Avoid_: insert between, interpose

**Rewire**:
Pointing a choice target at a different node.
_Avoid_: reconnect, relink, retarget

**Detach**:
Clearing a choice target, or clearing every reference to a node before it is deleted.
_Avoid_: unlink, disconnect, orphan
