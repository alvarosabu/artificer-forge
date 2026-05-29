<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  owner: Record<string, unknown>
  field: string
  flags: string[]
  abilities: string[]
  statusEffects: string[]
  items: string[]
}>()

type Row = Record<string, unknown>

const KEYS = ['setFlag', 'clearFlag', 'addStatusEffect', 'removeStatusEffect', 'learnAbility', 'giveItem', 'takeItem', 'endDialog']

const rows = computed<Row[]>(() => (props.owner[props.field] as Row[]) ?? [])

function defaultFor(key: string): Row {
  switch (key) {
    case 'setFlag': return { setFlag: { newFlag: true } }
    case 'addStatusEffect': return { addStatusEffect: { entity: 'player', id: '' } }
    case 'removeStatusEffect': return { removeStatusEffect: { entity: 'player', id: '' } }
    case 'giveItem': return { giveItem: { id: '', qty: 1 } }
    case 'takeItem': return { takeItem: { id: '', qty: 1 } }
    case 'endDialog': return { endDialog: true }
    default: return { [key]: '' }
  }
}

function keyOf(row: Row): string { return Object.keys(row)[0] ?? 'setFlag' }

function add() {
  const arr = (props.owner[props.field] ??= []) as Row[]
  arr.push(defaultFor('setFlag'))
}
function removeAt(i: number) {
  const arr = props.owner[props.field] as Row[]
  arr.splice(i, 1)
  if (arr.length === 0) delete props.owner[props.field]
}
function changeKey(i: number, key: string) {
  ;(props.owner[props.field] as Row[])[i] = defaultFor(key)
}

// setFlag helpers ({ setFlag: { name: value } })
function flagName(row: Row): string { return Object.keys(row.setFlag as object)[0] ?? '' }
function flagVal(row: Row): string { return String(Object.values(row.setFlag as object)[0] ?? 'true') }
function setSetFlag(row: Row, name: string, val: string) {
  row.setFlag = { [name]: val === 'true' ? true : val === 'false' ? false : Number(val) }
}
</script>

<template>
  <div class="eb">
    <div v-for="(row, i) in rows" :key="i" class="eb-row">
      <select class="eb-key" :value="keyOf(row)" @change="changeKey(i, ($event.target as HTMLSelectElement).value)">
        <option v-for="k in KEYS" :key="k" :value="k">{{ k }}</option>
      </select>

      <template v-if="keyOf(row) === 'setFlag'">
        <input class="eb-in" list="de-flags" placeholder="flag" :value="flagName(row)" @input="setSetFlag(row, ($event.target as HTMLInputElement).value, flagVal(row))">
        <select class="eb-sm" :value="flagVal(row)" @change="setSetFlag(row, flagName(row), ($event.target as HTMLSelectElement).value)">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </template>
      <template v-else-if="keyOf(row) === 'clearFlag'">
        <input v-model="(row as any).clearFlag" class="eb-in" list="de-flags" placeholder="flag">
      </template>
      <template v-else-if="keyOf(row) === 'addStatusEffect' || keyOf(row) === 'removeStatusEffect'">
        <select class="eb-sm" v-model="((row as any)[keyOf(row)]).entity">
          <option value="player">player</option>
          <option value="speaker">speaker</option>
        </select>
        <input v-model="((row as any)[keyOf(row)]).id" class="eb-in" list="de-status" placeholder="status id">
      </template>
      <template v-else-if="keyOf(row) === 'learnAbility'">
        <input v-model="(row as any).learnAbility" class="eb-in" list="de-abilities" placeholder="ability id">
      </template>
      <template v-else-if="keyOf(row) === 'giveItem' || keyOf(row) === 'takeItem'">
        <input v-model="((row as any)[keyOf(row)]).id" class="eb-in" list="de-items" placeholder="item id">
        <input v-model.number="((row as any)[keyOf(row)]).qty" class="eb-num" type="number" min="1">
      </template>
      <template v-else-if="keyOf(row) === 'endDialog'">
        <span class="eb-note">ends the dialog</span>
      </template>

      <button class="eb-del" title="Remove" @click="removeAt(i)">✕</button>
    </div>
    <button class="eb-add" @click="add">+ add effect</button>
  </div>
</template>

<style scoped>
.eb-row { display:flex; align-items:center; gap:5px; margin-bottom:5px; }
.eb-key, .eb-sm { background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:11px; padding:3px 4px; }
.eb-in { flex:1; min-width:0; background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:11px; padding:3px 6px; }
.eb-num { width:46px; background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:11px; padding:3px 4px; }
.eb-note { flex:1; color:#8b93a7; font-size:10px; font-style:italic; }
.eb-del { background:none; border:none; color:#e0556b; cursor:pointer; font-size:11px; }
.eb-add { background:none; border:1px dashed #3a4055; border-radius:5px; color:#6c8fff; font-size:10px; padding:3px 8px; cursor:pointer; margin-top:2px; }
</style>
