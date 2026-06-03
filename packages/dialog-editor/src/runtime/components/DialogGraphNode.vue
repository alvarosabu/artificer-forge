<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { DialogNode } from '../../types'
import { useNodeExpansion } from '../composables/useNodeExpansion'

const props = defineProps<{
  id: string
  data: { nodeId: string, node: DialogNode }
}>()

const { isExpanded, toggle } = useNodeExpansion()

const node = computed(() => props.data.node)
const choices = computed(() => node.value.choices ?? [])
const checkCount = computed(() => choices.value.filter(c => c.check).length)
const expanded = computed(() => isExpanded(props.id))
</script>

<template>
  <div class="de-node" :class="{ expanded }">
    <Handle type="target" :position="Position.Top" />
    <header class="de-hd">
      <span class="de-av">{{ (node.speaker ?? '·').slice(0, 1).toUpperCase() }}</span>
      <span class="de-id">{{ data.nodeId }}</span>
      <button class="de-chev" :title="expanded ? 'Collapse' : 'Expand'" @click.stop="toggle(id)">{{ expanded ? '▾' : '▸' }}</button>
      <span v-if="node.cameraShot" class="de-cam">{{ node.cameraShot }}</span>
    </header>
    <p class="de-text">{{ node.text }}</p>

    <template v-if="expanded">
      <div v-for="(choice, i) in choices" :key="i" class="de-choice">
        <div class="de-choice-main">
          <span v-if="choice.tagPrefix || choice.check" class="de-tag">
            {{ choice.tagPrefix ?? choice.check?.skill }}<template v-if="choice.check"> {{ choice.check.dc }}</template>
          </span>
          <span class="de-ctext">{{ choice.text }}</span>
          <Handle v-if="!choice.check" :id="`c${i}`" type="source" :position="Position.Right" />
        </div>
        <div v-if="choice.check" class="de-outcomes">
          <div class="de-outcome de-outcome--ok">
            <span class="de-dot" />
            <span>Success</span>
            <Handle :id="`c${i}-ok`" type="source" :position="Position.Right" class="h-ok" />
          </div>
          <div class="de-outcome de-outcome--fail">
            <span class="de-dot" />
            <span>Failure</span>
            <Handle :id="`c${i}-fail`" type="source" :position="Position.Right" class="h-fail" />
          </div>
        </div>
      </div>
    </template>
    <footer v-else class="de-footer" title="Expand" @click.stop="toggle(id)">
      {{ choices.length }} choices<template v-if="checkCount"> · {{ checkCount }} check{{ checkCount > 1 ? 's' : '' }}</template>
      <!-- Edges remap their sourceHandle to this bundle handle while collapsed. -->
      <Handle id="bundle" type="source" :position="Position.Right" />
    </footer>
  </div>
</template>

<style scoped>
.de-node { background:#1b1f2a; border:1px solid #353b4d; border-radius:10px; width:300px; font-size:12px; color:#e6e9f0; box-shadow:0 4px 14px rgba(0,0,0,.4); }
.de-hd { display:flex; align-items:center; gap:8px; padding:8px 10px; background:#222838; border-bottom:1px solid #353b4d; border-radius:10px 10px 0 0; }
.de-av { width:24px; height:24px; border-radius:50%; background:#6c4bd1; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; }
.de-id { font-weight:600; }
.de-chev { background:none; border:none; color:#8b93a7; cursor:pointer; font-size:13px; padding:0 2px; }
.de-chev:hover { color:#e6e9f0; }
.de-cam { margin-left:auto; font-size:9px; text-transform:uppercase; color:#8b93a7; border:1px solid #353b4d; border-radius:4px; padding:2px 5px; }
.de-text { padding:9px 10px; margin:0; color:#c3c9d6; line-height:1.4; }
.de-choice { padding:7px 10px; border-top:1px solid #2a3040; position:relative; }
.de-choice-main { display:flex; align-items:center; gap:7px; }
.de-ctext { flex:1; }
.de-tag { font-size:8.5px; font-weight:700; background:#3a2d5c; color:#c7b3ff; padding:1px 4px; border-radius:3px; }

/* Skill-check choices branch into success/failure; mirror the edge colors
   (e-ok #3fbf6f / e-fail #e0556b) so a row reads as the line it spawns. */
.de-outcomes { display:flex; flex-direction:column; gap:5px; margin-top:7px; }
.de-outcome { position:relative; display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:5px; font-size:9px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
.de-dot { flex:none; width:7px; height:7px; border-radius:50%; }
.de-outcome--ok { background:rgba(63,191,111,.12); color:#7fe0a3; }
.de-outcome--ok .de-dot { background:#3fbf6f; }
.de-outcome--fail { background:rgba(224,85,107,.12); color:#f0a0ac; }
.de-outcome--fail .de-dot { background:#e0556b; }

.de-footer { padding:7px 10px; border-top:1px solid #2a3040; color:#8b93a7; position:relative; cursor:pointer; }
.de-footer:hover { color:#c3c9d6; }
:deep(.h-ok) { background:#3fbf6f !important; }
:deep(.h-fail) { background:#e0556b !important; }
</style>
