<script setup lang="ts">
import { computed } from 'vue'

// Mutates owner[field] in place (the array lives on the reactive working tree,
// so changes propagate + mark dirty via the editor's deep watch).
const props = defineProps<{
  owner: Record<string, unknown>
  field: string
  flags: string[]
  classes: string[]
  abilities: string[]
  statusEffects: string[]
  items: string[]
}>()

type Row = Record<string, unknown>

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const OPS = ['gte', 'lte', 'gt', 'lt', 'eq']
const KEYS = ['flag', 'notFlag', 'class', 'race', 'faction', 'hasAbility', 'hasStatusEffect', 'stat', 'partyHas', 'hasItem']

const rows = computed<Row[]>(() => (props.owner[props.field] as Row[]) ?? [])

function defaultFor(key: string): Row {
  switch (key) {
    case 'stat': return { stat: { strength: { gte: 10 } } }
    case 'hasItem': return { hasItem: { id: '', qty: 1 } }
    default: return { [key]: '' }
  }
}

function keyOf(row: Row): string { return Object.keys(row)[0] ?? 'flag' }

function add() {
  const arr = (props.owner[props.field] ??= []) as Row[]
  arr.push(defaultFor('flag'))
}
function removeAt(i: number) {
  const arr = props.owner[props.field] as Row[]
  arr.splice(i, 1)
  if (arr.length === 0) delete props.owner[props.field]
}
function changeKey(i: number, key: string) {
  ;(props.owner[props.field] as Row[])[i] = defaultFor(key)
}

// stat helpers
function statName(row: Row): string { return Object.keys(row.stat as object)[0] ?? 'strength' }
function statOp(row: Row): string { return Object.keys((row.stat as Record<string, object>)[statName(row)] ?? {})[0] ?? 'gte' }
function statVal(row: Row): number { return Number(Object.values((row.stat as Record<string, Record<string, unknown>>)[statName(row)] ?? {})[0] ?? 0) }
function setStat(row: Row, name: string, op: string, val: number) { row.stat = { [name]: { [op]: val } } }
</script>

<template>
  <div class="cb">
    <div v-for="(row, i) in rows" :key="i" class="cb-row">
      <select class="cb-key" :value="keyOf(row)" @change="changeKey(i, ($event.target as HTMLSelectElement).value)">
        <option v-for="k in KEYS" :key="k" :value="k">{{ k }}</option>
      </select>

      <template v-if="keyOf(row) === 'flag'">
        <input v-model="(row as any).flag" class="cb-in" list="de-flags" placeholder="flag name">
      </template>
      <template v-else-if="keyOf(row) === 'notFlag'">
        <input v-model="(row as any).notFlag" class="cb-in" list="de-flags" placeholder="flag name">
      </template>
      <template v-else-if="keyOf(row) === 'class'">
        <input v-model="(row as any).class" class="cb-in" list="de-classes" placeholder="class id">
      </template>
      <template v-else-if="keyOf(row) === 'race'">
        <input v-model="(row as any).race" class="cb-in" placeholder="race">
      </template>
      <template v-else-if="keyOf(row) === 'faction'">
        <input v-model="(row as any).faction" class="cb-in" placeholder="faction">
      </template>
      <template v-else-if="keyOf(row) === 'hasAbility'">
        <input v-model="(row as any).hasAbility" class="cb-in" list="de-abilities" placeholder="ability id">
      </template>
      <template v-else-if="keyOf(row) === 'hasStatusEffect'">
        <input v-model="(row as any).hasStatusEffect" class="cb-in" list="de-status" placeholder="status id">
      </template>
      <template v-else-if="keyOf(row) === 'partyHas'">
        <input v-model="(row as any).partyHas" class="cb-in" placeholder="class / templateId">
      </template>
      <template v-else-if="keyOf(row) === 'stat'">
        <select class="cb-sm" :value="statName(row)" @change="setStat(row, ($event.target as HTMLSelectElement).value, statOp(row), statVal(row))">
          <option v-for="s in STATS" :key="s" :value="s">{{ s.slice(0, 3) }}</option>
        </select>
        <select class="cb-sm" :value="statOp(row)" @change="setStat(row, statName(row), ($event.target as HTMLSelectElement).value, statVal(row))">
          <option v-for="o in OPS" :key="o" :value="o">{{ o }}</option>
        </select>
        <input class="cb-num" type="number" :value="statVal(row)" @input="setStat(row, statName(row), statOp(row), Number(($event.target as HTMLInputElement).value))">
      </template>
      <template v-else-if="keyOf(row) === 'hasItem'">
        <input v-model="((row as any).hasItem).id" class="cb-in" list="de-items" placeholder="item id">
        <input v-model.number="((row as any).hasItem).qty" class="cb-num" type="number" min="1">
      </template>

      <button class="cb-del" title="Remove" @click="removeAt(i)">✕</button>
    </div>
    <button class="cb-add" @click="add">+ add condition</button>
  </div>
</template>

<style scoped>
.cb-row { display:flex; align-items:center; gap:5px; margin-bottom:5px; }
.cb-key, .cb-sm { background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:11px; padding:3px 4px; }
.cb-in { flex:1; min-width:0; background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:11px; padding:3px 6px; }
.cb-num { width:46px; background:#11141c; border:1px solid #3a4055; border-radius:5px; color:#dfe3ec; font-size:11px; padding:3px 4px; }
.cb-del { background:none; border:none; color:#e0556b; cursor:pointer; font-size:11px; }
.cb-add { background:none; border:1px dashed #3a4055; border-radius:5px; color:#6c8fff; font-size:10px; padding:3px 8px; cursor:pointer; margin-top:2px; }
</style>
