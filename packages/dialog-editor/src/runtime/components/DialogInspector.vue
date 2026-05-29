<script setup lang="ts">
import { computed } from 'vue'
import type { DialogChoice, DialogNode, DialogTree } from '../../types'

const props = defineProps<{
  tree: DialogTree | null
  nodeId: string | null
  choiceIndex: number | null
  skills: string[]
  items: string[]
  abilities: string[]
  statusEffects: string[]
  classes: string[]
  flags: string[]
}>()
const emit = defineEmits<{
  (e: 'select-choice', i: number | null): void
  (e: 'add-choice'): void
  (e: 'delete-choice', i: number): void
  (e: 'delete-node'): void
}>()

const CAMERA_SHOTS = ['', 'three-quarter', 'over-shoulder', 'closeup', 'wide', 'two-shot']
const LOCKED = ['', 'hide', 'lock']

const node = computed<DialogNode | null>(() => (props.nodeId && props.tree ? props.tree.nodes[props.nodeId] ?? null : null))
const choices = computed<DialogChoice[]>(() => node.value?.choices ?? [])
const choice = computed<DialogChoice | null>(() => (props.choiceIndex != null ? choices.value[props.choiceIndex] ?? null : null))
const nodeIds = computed(() => (props.tree ? [...Object.keys(props.tree.nodes), '__end'] : ['__end']))

const isCheck = computed(() => !!choice.value?.check)

function toggleCheck(on: boolean) {
  const c = choice.value
  if (!c) return
  if (on) {
    c.check = { skill: 'persuasion', dc: 10 }
    c.onSuccess = { next: c.next ?? '__end' }
    c.onFailure = { next: '__end' }
    delete c.next
  }
  else {
    c.next = c.onSuccess?.next ?? '__end'
    delete c.check
    delete c.onSuccess
    delete c.onFailure
  }
}

function ensureBranch(which: 'onSuccess' | 'onFailure') {
  const c = choice.value
  if (c && !c[which]) c[which] = {}
  return c?.[which] as Record<string, unknown>
}
</script>

<template>
  <aside class="insp">
    <!-- shared datalists for builders -->
    <datalist id="de-flags"><option v-for="f in flags" :key="f" :value="f" /></datalist>
    <datalist id="de-items"><option v-for="i in items" :key="i" :value="i" /></datalist>
    <datalist id="de-abilities"><option v-for="a in abilities" :key="a" :value="a" /></datalist>
    <datalist id="de-status"><option v-for="s in statusEffects" :key="s" :value="s" /></datalist>
    <datalist id="de-classes"><option v-for="c in classes" :key="c" :value="c" /></datalist>
    <datalist id="de-skills"><option v-for="s in skills" :key="s" :value="s" /></datalist>
    <datalist id="de-speakers"><option v-for="id in nodeIds" :key="id" :value="id" /></datalist>

    <div v-if="!node" class="insp-empty">
      Select a node to edit it.
    </div>

    <template v-else>
      <div class="insp-hd">
        <h4>Node · {{ nodeId }}</h4>
        <button class="insp-danger" @click="emit('delete-node')">Delete</button>
      </div>

      <label class="fld"><span>Speaker</span>
        <input v-model="node.speaker" class="in" placeholder="entity templateId (blank = narrator)">
      </label>
      <label class="fld"><span>Camera shot</span>
        <select v-model="node.cameraShot" class="in">
          <option v-for="s in CAMERA_SHOTS" :key="s" :value="s || undefined">{{ s || '— none —' }}</option>
        </select>
      </label>
      <label class="fld"><span>Camera target</span>
        <input v-model="node.cameraTarget" class="in" placeholder="entityId override (optional)">
      </label>
      <label class="fld"><span>Text</span>
        <textarea v-model="node.text" class="in ta" rows="3" />
      </label>

      <div class="sec-hd">On-entry effects</div>
      <DeEffectBuilder :owner="node" field="effects" :flags="flags" :abilities="abilities" :status-effects="statusEffects" :items="items" />

      <div class="sec-hd row">
        <span>Choices ({{ choices.length }})</span>
        <button class="insp-add" @click="emit('add-choice')">+ choice</button>
      </div>
      <ul class="choice-list">
        <li
          v-for="(c, i) in choices" :key="i"
          class="choice-item" :class="{ active: i === choiceIndex }"
          @click="emit('select-choice', i === choiceIndex ? null : i)"
        >
          <span class="ci-idx">{{ i }}</span>
          <span class="ci-text">{{ c.text || '(empty)' }}</span>
          <span v-if="c.check" class="ci-badge">{{ c.check.skill }} {{ c.check.dc }}</span>
        </li>
      </ul>

      <div v-if="choice" class="choice-edit">
        <label class="fld"><span>Choice text</span>
          <input v-model="choice.text" class="in">
        </label>
        <label class="fld"><span>Tag prefix</span>
          <input v-model="choice.tagPrefix" class="in" placeholder="e.g. PERSUASION (optional)">
        </label>

        <label class="fld chk"><input type="checkbox" :checked="isCheck" @change="toggleCheck(($event.target as HTMLInputElement).checked)"> Skill check</label>

        <template v-if="isCheck && choice.check">
          <div class="row3">
            <label class="fld"><span>Skill</span><input v-model="choice.check.skill" class="in" list="de-skills"></label>
            <label class="fld sm"><span>DC</span><input v-model.number="choice.check.dc" class="in" type="number"></label>
            <label class="fld chk2"><input v-model="choice.check.advantage" type="checkbox"> adv</label>
          </div>
          <label class="fld"><span>On success → node</span>
            <select :value="choice.onSuccess?.next ?? '__end'" class="in" @change="(ensureBranch('onSuccess')).next = ($event.target as HTMLSelectElement).value">
              <option v-for="id in nodeIds" :key="id" :value="id">{{ id }}</option>
            </select>
          </label>
          <div class="sec-hd sub">Success effects</div>
          <DeEffectBuilder :owner="ensureBranch('onSuccess')" field="effects" :flags="flags" :abilities="abilities" :status-effects="statusEffects" :items="items" />
          <label class="fld"><span>On failure → node</span>
            <select :value="choice.onFailure?.next ?? '__end'" class="in" @change="(ensureBranch('onFailure')).next = ($event.target as HTMLSelectElement).value">
              <option v-for="id in nodeIds" :key="id" :value="id">{{ id }}</option>
            </select>
          </label>
          <div class="sec-hd sub">Failure effects</div>
          <DeEffectBuilder :owner="ensureBranch('onFailure')" field="effects" :flags="flags" :abilities="abilities" :status-effects="statusEffects" :items="items" />
        </template>
        <template v-else>
          <label class="fld"><span>Next node</span>
            <select v-model="choice.next" class="in">
              <option v-for="id in nodeIds" :key="id" :value="id">{{ id }}</option>
            </select>
          </label>
        </template>

        <div class="sec-hd sub">Conditions (all must pass)</div>
        <DeConditionBuilder :owner="choice" field="conditions" :flags="flags" :classes="classes" :abilities="abilities" :status-effects="statusEffects" :items="items" />

        <div class="sec-hd sub">Effects (on choose)</div>
        <DeEffectBuilder :owner="choice" field="effects" :flags="flags" :abilities="abilities" :status-effects="statusEffects" :items="items" />

        <label class="fld"><span>Locked display</span>
          <select v-model="choice.lockedDisplay" class="in">
            <option v-for="l in LOCKED" :key="l" :value="l || undefined">{{ l || 'lock (default)' }}</option>
          </select>
        </label>

        <button class="insp-danger full" @click="emit('delete-choice', choiceIndex!)">Delete choice</button>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.insp { width:280px; flex:none; border-left:1px solid #353b4d; background:#1b1f2a; color:#e6e9f0; overflow-y:auto; padding:12px; font-size:12px; }
.insp-empty { color:#8b93a7; padding:20px 4px; text-align:center; }
.insp-hd { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
.insp-hd h4 { margin:0; font-size:13px; }
.fld { display:block; margin-bottom:8px; }
.fld > span { display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.5px; color:#8b93a7; margin-bottom:3px; }
.in { width:100%; box-sizing:border-box; background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:12px; padding:5px 7px; }
.ta { resize:vertical; font-family:inherit; }
.chk, .chk2 { display:flex; align-items:center; gap:6px; font-size:11px; color:#c3c9d6; }
.chk2 > input { margin:0; }
.row3 { display:flex; gap:6px; align-items:flex-end; }
.row3 .sm { width:64px; flex:none; }
.sec-hd { font-size:9.5px; text-transform:uppercase; letter-spacing:1px; color:#8b93a7; margin:12px 0 6px; border-top:1px solid #2a3040; padding-top:8px; }
.sec-hd.sub { margin-top:8px; border-top:none; padding-top:4px; }
.sec-hd.row { display:flex; align-items:center; justify-content:space-between; }
.choice-list { list-style:none; margin:0 0 8px; padding:0; }
.choice-item { display:flex; align-items:center; gap:6px; padding:5px 6px; border:1px solid #2a3040; border-radius:5px; margin-bottom:4px; cursor:pointer; }
.choice-item.active { border-color:#6c4bd1; background:#232a3a; }
.ci-idx { color:#8b93a7; font-size:10px; }
.ci-text { flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ci-badge { font-size:8.5px; background:#3a2d5c; color:#c7b3ff; padding:1px 4px; border-radius:3px; }
.choice-edit { border-top:1px solid #2a3040; padding-top:10px; }
.insp-add { background:none; border:1px solid #3a4055; border-radius:5px; color:#6c8fff; font-size:10px; padding:2px 7px; cursor:pointer; }
.insp-danger { background:none; border:1px solid #5a3a4a; border-radius:5px; color:#e0556b; font-size:10px; padding:3px 8px; cursor:pointer; }
.insp-danger.full { width:100%; margin-top:10px; padding:6px; }
</style>
