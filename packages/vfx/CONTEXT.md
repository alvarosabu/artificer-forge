# VFX

Visual effects that the Engine mounts into a scene: combat markers, floating numbers, TSL materials for characters and surfaces, and particle systems. Grading, wind and trample are Engine vocabulary, not VFX.

## Language

### Combat markers

**Target reticle**:
The flat pulsing ring drawn on the ground under the hovered combat target.
_Avoid_: targeting circle, ring, target marker

**Target indicator**:
The pulsing vertical cylinder that marks a point in the scene, used for the hovered target and for a projectile landing point.
_Avoid_: depth cue, vertical cylinder, beam

**Damage number**:
A per-hit floating label, colored by damage type, that arcs up and removes itself when its animation ends. A critical hit gets a larger label with a `!` suffix.
_Avoid_: floating text, hit text, damage popup

### Character materials

**Status overlay**:
An emissive TSL layer grafted onto a character's material for one of three looks: poisoned, burning, frozen. The gameplay status effect itself belongs to the Engine.
_Avoid_: status effect, emissive builder, overlay effect

**Horn material set**:
The standard and toon material pair for tiefling horns, sharing one base-to-tip color gradient.
_Avoid_: horn shader, horn gradient

**Ghost material**:
The transparent Fresnel rim-glow material for spectral characters.
_Avoid_: ethereal material, shimmer material

### Surfaces

**Field texture**:
A packed data texture of per-cell surface coverage (water, oil, poison, blood) and state (electrified charge, frozen) that every surface material and particle system samples. The Engine packs it; VFX reads it.
_Avoid_: field map, coverage map, data texture

**Kind**:
One of the four liquids a cell can hold. A cell holds one kind at a time.
_Avoid_: liquid type, surface type, fluid

**Pool surface**:
The single flat material that renders every liquid kind on one plane, plus its frozen (ice sheet) and electrified (bolt arcs) variants.
_Avoid_: liquid overlay, water material, pool material

**Fire surface**:
The additive flat flame layer drawn over burning cells.
_Avoid_: flame layer, fire overlay

**Charcoal bed**:
The displaced, subdivided plane under a fire surface whose humps glow in the valleys.
_Avoid_: coal bed, ash layer, ground relief

### Particles

**Ember system**:
Rising spark particles above burning cells. Two implementations exist: a CPU points system and a GPU instanced system.
_Avoid_: sparks, spark system, fire particles

**Fire billboards**:
Instanced upright quads that face the camera around a vertical axis and show a flame, either procedural or from a flipbook.
_Avoid_: flame sprites, fire quads, flame cards

**Flipbook**:
A sprite-sheet animation (16 by 4 frames) that a fire billboard can play instead of the procedural flame.
_Avoid_: sprite sheet, texture atlas animation
