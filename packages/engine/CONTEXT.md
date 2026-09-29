# Engine

The game runtime every app builds on: pure RPG rules in `core`, Vue and Tres stores, systems and scene components in `runtime`, and the HUD in `ui`. Apps own content, routes and policy; the Engine owns the mechanism. Every other context borrows these terms.

## Language

### Entities

**Entity template**:
The static YAML definition of a thing that can exist in the world, identified by `templateId`.
_Avoid_: definition, blueprint, prefab, archetype

**Entity**:
A spawned, mutable copy of a template living in the game store. Characters, items and interactables are all entities.
_Avoid_: instance, entity state, object, thing

**Content source**:
The bundle of resolvers an app injects so the Engine can look up templates, scenes, abilities, dialogs and classes. The Engine never fetches content itself.
_Avoid_: resolver, gateway, content loader, provider

**Scene**:
A YAML level: a list of template placements plus named spawn points and exits. Three's `Scene` is always "Three scene".
_Avoid_: level, map, stage, Three scene

**Spawn point**:
A named position in a scene where entities arrive on scene load or through an exit.
_Avoid_: spawn, start position, waypoint

**Flag**:
A named boolean or number of world state, set by dialogs and interactions and read by conditions.
_Avoid_: world flag, quest progress, variable, switch

### Actors and party

**Actor**:
A character that inhabits the world under actor behavior: an NPC or an enemy. Party members are characters, not actors.
_Avoid_: NPC (when enemies are included), mob, agent

**Party**:
The player's group: its members and its leader.
_Avoid_: squad, team (see Team), group

**Companion**:
A recruitable character who can join or leave the party.
_Avoid_: follower, ally (see Team), party member (only once recruited)

**Team**:
An entity's allegiance, one of player, ally, neutral or hostile. It decides outline color and who can be targeted.
_Avoid_: faction, side, alignment

**Scene ref**:
The imperative handle a spawned character or interactable registers under its entity id, so stores, HUD and dialog can command it (play, move, show damage).
_Avoid_: exposed ref, handle, registry entry, controller

**Entity action**:
One right-click action valid for an entity: Examine, Talk, Attack, Loot, Pick Up. The command palette is playground debug UI, not this.
_Avoid_: command, context menu item, interaction

### Combat

**Ability**:
A YAML-authored castable action with a targeting mode, animations, damage dice and an optional projectile.
_Avoid_: spell, skill, power, attack (bare)

**Targeting mode**:
How an ability picks its target: lock-on, ground or self.
_Avoid_: target type, cast mode

**Targeting phase**:
Where a cast stands: idle, selecting or executing.
_Avoid_: cast state, ability state

**Projectile**:
The moving object an ability launches toward its target along a straight, parabolic or distance-based arc.
_Avoid_: missile, bullet, bolt

**AoE**:
Area-of-effect target math and its ground preview, shaped as a circle, cone or line.
_Avoid_: blast, area attack, ground targeting

**Action bar**:
The HUD row of usable things for the active character.
_Avoid_: hotbar, skill bar, toolbar

**Action slot**:
One entry in the action bar: an ability, an item or a passive, with a cost of action, bonus action or free.
_Avoid_: hotkey, bar entry, button

**Action points**:
The per-turn budget an action slot's cost draws from.
_Avoid_: AP, stamina, energy

### Status effects and surfaces

**Status effect**:
A timed condition on an entity from a closed id set (burning, wet, frozen, ...), with content-authored presentation. Buff, debuff, dot and cc are its types, not synonyms.
_Avoid_: effect, condition, buff, debuff, overlay (see VFX)

**Surface**:
Ground hazards simulated as a grid of cells that spread, react and decay.
_Avoid_: puddle, pool, hazard, field

**Surface kind**:
What a cell holds: fire, water, oil, poison or blood. One kind per cell.
_Avoid_: variant, surface type, liquid, element

**Cell state**:
The flags orthogonal to kind: frozen and electrified. Freezing pauses decay; a charge electrifies water and blood.
_Avoid_: variant, modifier, status (of a cell)

**Surface source**:
A growing emitter of one kind, such as a spreading puddle.
_Avoid_: emitter, spawner, seed, stamp

**Charge source**:
A timed lightning charge that electrifies conductive cells within reach.
_Avoid_: electric source, shock, zap

### Dialog

**Dialog engine**:
The runtime that walks a dialog tree: evaluates conditions, rolls checks, applies effects and resolves choices. Tree, node, choice, check, condition, effect and camera shot are defined in the Dialog Editor glossary and mean the same here.
_Avoid_: dialog system, conversation runner, dialog store (that is only the open-dialog state)

**Camera director**:
The runtime piece that frames speakers according to a node's camera shot.
_Avoid_: dialog camera, cinematic camera, shot controller

### Inventory

**Container**:
Anything that holds item entities: a character's bag, a chest, a corpse. An item points at its container by id.
_Avoid_: inventory (as an object), storage, stash

**World item**:
An item entity with no container, lying in the scene and pickable.
_Avoid_: dropped item, ground item, pickup

**Loot**:
Taking items out of a container that is not your own.
_Avoid_: pick up (that is a world item), take, plunder

**Equipment slot**:
One of the eleven sockets an item can be equipped in (main hand, off hand, rings, ...). Bare "slot" in the Engine means this.
_Avoid_: slot (when another slot is meant), gear slot, socket

**Encumbrance**:
The ratio of carried weight to carry capacity.
_Avoid_: weight limit, load, burden

### Character look

**Appearance**:
The purely cosmetic recipe of part ids and colors that turns a character into a modular assembly instead of a single GLB.
_Avoid_: recipe, look, customization, skin

**Modular slot**:
One of the six armor visual slots that render meshes on a modular character. Cosmetic, distinct from an equipment slot.
_Avoid_: slot, armor slot, part slot

**Portrait**:
A character's headshot baked offline in a hidden studio scene and cached by a signature derived from appearance, gear and background.
_Avoid_: headshot, avatar, thumbnail

**Bake queue**:
The serializer that renders portraits one at a time.
_Avoid_: render queue, job queue

### World rendering

**Grading**:
The unlit stylized lighting contract every environment material shares: light tint, shadow ramp, fog as sky. It is lighting, not post-processing color grading.
_Avoid_: color grading, lighting model, tone

**Stylized output**:
The finish step a graded material applies to its final color.
_Avoid_: output node, finish pass, post grading

**Preset track**:
A loop from 0 to 1 that blends between ordered presets. An app's day cycle drives it; the day cycle itself is app policy.
_Avoid_: day cycle (in the Engine), timeline, tween

**Control map**:
The painted RGB texture from Blender that says which surface each terrain pixel is (red road, green grass, blue water).
_Avoid_: splat map, mask, terrain map

**Height field**:
The baked terrain height texture sampled on the GPU.
_Avoid_: heightmap (as a runtime object), displacement, elevation map

**Quadtree**:
The instanced level-of-detail tiling of the terrain around the camera.
_Avoid_: LOD grid, chunks, tiles

**Scatter focus**:
The moving center that grass and flower windows follow. Window size sets both range and density.
_Avoid_: focus (bare, see Post-processing), scatter center, anchor

**Trample map**:
The texture recording where characters have pressed the vegetation down.
_Avoid_: footprint map, flatten map, displacement

**Wind**:
The shared uniforms that sway every piece of vegetation the same way.
_Avoid_: breeze, sway, gust
