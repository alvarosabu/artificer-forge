# Assets

Shared 3D files (models, textures, animations) plus the Nuxt module that scans the character folders into a part manifest. The filesystem is the database: a part exists because its GLB exists.

## Language

### Parts

**Part**:
A single GLB in a slot folder that binds to a shared skeleton (body, head, hair, beard, eyebrows, horns, accessory). The atomic unit of a modular character.
_Avoid_: part GLB, KayKit part, mesh, model

**Part id**:
The filename stem of a part. It is at once the manifest key, the mesh node name inside the GLB, and the value an appearance stores.
_Avoid_: stem, mesh node name, manifest id

**Slot folder**:
One of the seven directories under `files/models/characters` that the scanner reads. The folder a part sits in is its category. Bare "slot" belongs to the Engine and means an equipment socket.
_Avoid_: slot, category, part type

**Naming convention**:
The positional filename scheme `{RACE}_{SEX}_{Part}_{Variant}` (for example `HUM_M_Head_A`) that encodes race, sex, rig size and variant. Stems outside it are skipped with a warning.
_Avoid_: KayKit names, naming scheme, file pattern

**Race**:
The eligibility tag a part carries from its filename prefix (`HUM`, `ELF`, `TIF`, `GOB`); `GEN` means any medium-rig race.
_Avoid_: species, race prefix

**Sex**:
The second eligibility tag (`M` or `F`). A part without one is unisex.
_Avoid_: gender, bodyType

**Part override**:
A hand-maintained exception entry, keyed by part id, that adds facts the filename cannot express. Exceptions only, never inventory.
_Avoid_: manifest exception, part config

### Manifest

**Part manifest**:
The build-time inventory of parts and rigs produced by scanning the filesystem and shipped to apps as a virtual module.
_Avoid_: character parts, generated manifest, part list

**Rig**:
The bare skeleton a body binds to, `medium` or `small`, shipped as its own GLB.
_Avoid_: skeleton, armature, rig size

### Bodies and looks

**Body segment**:
A named child mesh of a body GLB (`Torso`, `ArmL`, `Hips`, `FootR`, ...). Armor hides segments; appearance can swap a segment's material.
_Avoid_: limb, segment token, body piece

**Tint atlas**:
A recolored copy of an item's texture atlas, selected per equipment slot by tint id.
_Avoid_: palette, atlas variant, recolor

**Animation pack**:
One GLB per rig size and movement category (for example `Rig_Medium_Combat`), loaded as a set and merged with the clips inside the character GLB.
_Avoid_: animation library, clip pack, anim set
