import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
// @ts-expect-error - virtual import resolved by Nitro at runtime
import { createError, defineEventHandler, getRouterParam, readBody, useRuntimeConfig } from '#imports'
import type { LayoutMap } from '../../../../../types'

export default defineEventHandler(async (event: unknown) => {
  // @ts-expect-error - import.meta.dev injected by Nitro
  if (!import.meta.dev) throw createError({ statusCode: 403, statusMessage: 'dialog editor is dev-only' })

  const id = getRouterParam(event, 'id')
  const { layoutDir } = useRuntimeConfig().dialogEditor as { layoutDir: string }
  const body = await readBody(event) as LayoutMap

  const dir = resolve(process.cwd(), layoutDir)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${id}.json`), JSON.stringify(body, null, 2), 'utf8')

  return { ok: true }
})
