import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
// @ts-expect-error - virtual import resolved by Nitro at runtime
import { createError, defineEventHandler, getRouterParam, readBody, useRuntimeConfig } from '#imports'
import type { DialogTree } from '../../../../types'
import { parseDialog } from '../../../utils/parse'
import { serializeDialog } from '../../../utils/serialize'

export default defineEventHandler(async (event: unknown) => {
  // @ts-expect-error - import.meta.dev injected by Nitro
  if (!import.meta.dev) throw createError({ statusCode: 403, statusMessage: 'dialog editor is dev-only' })

  const id = getRouterParam(event, 'id')
  const { dialogsDir } = useRuntimeConfig().dialogEditor as { dialogsDir: string }
  const dir = resolve(process.cwd(), dialogsDir)

  const body = await readBody(event) as { tree?: DialogTree } | DialogTree
  const tree = parseDialog((body as { tree?: DialogTree }).tree ?? body)
  if (tree.dialogId !== id) {
    throw createError({ statusCode: 400, statusMessage: `dialogId "${tree.dialogId}" does not match route id "${id}"` })
  }

  // Reuse the existing file for this dialogId, else create `<id>.yaml`.
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
  let filename = `${id}.yaml`
  for (const file of files) {
    const raw = parseYaml(await readFile(join(dir, file), 'utf8'))
    if (raw?.dialogId === id) {
      filename = file
      break
    }
  }

  await writeFile(join(dir, filename), serializeDialog(tree), 'utf8')
  return { ok: true, file: filename }
})
