import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
// @ts-expect-error - virtual import resolved by Nitro at runtime
import { createError, defineEventHandler, getRouterParam, useRuntimeConfig } from '#imports'
import type { LayoutMap } from '../../../../types'
import { parseDialog } from '../../../utils/parse'

export default defineEventHandler(async (event: unknown) => {
  // @ts-expect-error - import.meta.dev injected by Nitro
  if (!import.meta.dev) throw createError({ statusCode: 403, statusMessage: 'dialog editor is dev-only' })

  const id = getRouterParam(event, 'id')
  const { dialogsDir, layoutDir } = useRuntimeConfig().dialogEditor as { dialogsDir: string, layoutDir: string }
  const dir = resolve(process.cwd(), dialogsDir)
  const files = (await readdir(dir)).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))

  for (const file of files) {
    const raw = parseYaml(await readFile(join(dir, file), 'utf8'))
    const tree = parseDialog(raw)
    if (tree.dialogId === id) {
      let layout: LayoutMap = {}
      try {
        layout = JSON.parse(await readFile(join(resolve(process.cwd(), layoutDir), `${id}.json`), 'utf8'))
      }
      catch { /* no sidecar yet */ }
      return { tree, layout, file }
    }
  }

  throw createError({ statusCode: 404, statusMessage: `dialog "${id}" not found` })
})
