# Post-processing

The full-frame pipeline that takes over drawing from TresJS: bloom, depth of field, tilt-shift, godrays, outlines and antialiasing, built once as a TSL node graph. Character grading and the stylized output finish are Engine vocabulary.

## Language

### Pipeline

**Effect composer**:
The renderless component that builds the pipeline and replaces the canvas render function. It is not Three's `EffectComposer`; it wraps a `RenderPipeline`.
_Avoid_: composer stack, render chain, effect stack

**Pipeline**:
The fixed order of passes: scene, godrays, blur (tilt-shift or depth of field), outlines, bloom, output, FXAA.
_Avoid_: chain, graph, effect order

**Pass**:
One real render stage in the pipeline. The outline registry carries the word in its name but draws nothing today.
_Avoid_: stage, effect, node (when meaning a stage)

**Baked option**:
A pass option compiled into the shader, such as blur sigma or edge radius. Changing one rebuilds the pipeline.
_Avoid_: static option, rebuild knob, compile-time option

**Live uniform**:
A pass option that updates in place on the next frame without a rebuild, such as bloom strength.
_Avoid_: runtime knob, dynamic option, hot uniform

**Resolution scale**:
The fraction of the drawing buffer a pass uses for its internal render targets while the composite stays full size. Each pass has its own default.
_Avoid_: quarter res, half-res, downscale

**Antialias mode**:
The build-time choice between `msaa`, `fxaa` and `none`. It cannot change at runtime.
_Avoid_: AA setting, sample mode, smoothing

### Focus

**Focus target**:
The one object whose distance along the camera axis drives the focus distance shared by depth of field and tilt-shift.
_Avoid_: focus plane, tracked object, dof target

**Focus distance**:
The smoothed camera-axis distance to the focus target, or the static fallback when no target is registered.
_Avoid_: focal distance, focus depth

**Focal range**:
The depth band, in world units, kept sharp around the focus distance. It is not a lens focal length.
_Avoid_: focalLength, focus band, depth band

### Passes

**Scaled bloom**:
The stock bloom node with a resolution scale, fed the unblurred scene color so its threshold sees true highlights.
_Avoid_: glow, bloom pass

**Scaled depth of field**:
The stock depth of field node with a resolution scale on its internal targets.
_Avoid_: DOF (use "depth of field" or `dof`), bokeh pass

**Tilt-shift**:
A screen-space blur masked by distance from a horizontal sharp band, giving the miniature look. When set, it replaces depth of field.
_Avoid_: miniature effect, diorama blur, tilt shift

**Godrays**:
A shadow-map raymarch composited onto the raw scene before any blur.
_Avoid_: rays, volumetric light, light shafts

**Godrays light**:
The directional or point light registered through the provider so godrays has a source. Without one the pass is skipped with a warning.
_Avoid_: sun light, ray source

**Outline group**:
A named set of objects registered for edge highlighting. The group name doubles as the preset key.
_Avoid_: selection group, selection mask, highlight set
