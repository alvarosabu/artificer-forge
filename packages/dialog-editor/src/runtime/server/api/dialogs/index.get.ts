import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
// @ts-expect-error - virtual import resolved by Nitro at runtime
import { createError, defineEventHandler, useRuntimeConfig } from '#imports'
import { parseDialog } from '../../../utils/parse'
import { harvestFlags } from '../../../utils/harvestFlags'

export default defineEventHandler(async () => {
  // @ts-expect-error - import.meta.dev injected by Nitro
  if (!import.meta.dev) throw createError({ statusCode: 403, statusMessage: 'dialog editor is dev-only' })

  const { dialogsDir } = useRuntimeConfig().dialogEditor as { dialogsDir: string }
  const dir = resolve(process.cwd(), dialogsDir)
  const files = (await readdir(dir)).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

  const trees = []
  for (const file of files) {
    const raw = parseYaml(await readFile(join(dir, file), 'utf8'))
    trees.push({ file, tree: parseDialog(raw) })
  }

  return {
    dialogs: trees.map(t => ({ id: t.tree.dialogId, file: t.file, startNode: t.tree.startNode })),
    flags: harvestFlags(trees.map(t => t.tree)),
  }
})
