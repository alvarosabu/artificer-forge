import type { Plugin } from 'vite'
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export interface PublicAssetsOptions {
  /** Folder to watch. Defaults to `<vite root>/public`. */
  dir?: string
  /** GLBs whose terrain gets baked into a height field. */
  terrain?: RegExp
  /** GLB node the bake reads, same contract as the runtime. */
  terrainNode?: string
  resolution?: number
}

const BAKE_SCRIPT = fileURLToPath(new URL('../../../scripts/bake-heightmap.mjs', import.meta.url))

// Blender writes a GLB in several chunks, and each chunk fires a change event
const SETTLE_MS = 300

const BAKE_OUTPUT = /\.height-\d+\.(?:rgb\.png|png|json)$/

/**
 * Dev-only. Reloads the page when a file in `public/` changes, and re-bakes the
 * height field next to every terrain GLB before that reload.
 */
export function publicAssets(options: PublicAssetsOptions = {}): Plugin {
  const terrain = options.terrain ?? /-terrain\.glb$/i
  const terrainNode = options.terrainNode ?? 'Terrain'
  const resolution = options.resolution ?? 2048

  return {
    name: 'game:public-assets',
    apply: 'serve',
    configureServer(server) {
      const dir = options.dir ?? resolve(server.config.root, 'public')
      const logger = server.config.logger
      const label = (file: string) => relative(dir, file)

      const bakes = new Map<string, { running: boolean, again: boolean, timer?: NodeJS.Timeout }>()
      let reloadTimer: NodeJS.Timeout | undefined

      const isBaking = () => [...bakes.values()].some(b => b.running || b.timer)

      // Held back while a bake runs: its outputs fire change events of their
      // own, and the page should reload once, with the new height field in place.
      function scheduleReload() {
        clearTimeout(reloadTimer)
        reloadTimer = setTimeout(() => {
          if (isBaking()) return
          logger.info('[public-assets] full reload', { timestamp: true })
          server.ws.send({ type: 'full-reload', path: '*' })
        }, SETTLE_MS)
      }

      function runBake(glb: string): Promise<void> {
        return new Promise((done) => {
          const args = [BAKE_SCRIPT, glb, '--node', terrainNode, '--resolution', String(resolution)]
          // child process: the bake is ~1 s of CPU and would stall the dev server
          execFile(process.execPath, args, (error, stdout, stderr) => {
            if (error) logger.error(`[public-assets] height field bake failed for ${label(glb)}\n${stderr || error.message}`, { timestamp: true })
            else logger.info(`[public-assets] ${stdout.split('\n')[0]}`, { timestamp: true })
            done()
          })
        })
      }

      function queueBake(glb: string) {
        const state = bakes.get(glb) ?? { running: false, again: false }
        bakes.set(glb, state)
        clearTimeout(state.timer)
        state.timer = setTimeout(async () => {
          state.timer = undefined
          // a re-export mid-bake would leave a stale height field; bake once more after
          if (state.running) {
            state.again = true
            return
          }
          state.running = true
          do {
            state.again = false
            await runBake(glb)
          } while (state.again)
          state.running = false
          scheduleReload()
        }, SETTLE_MS)
      }

      function heightFieldFor(glb: string) {
        return join(glb, '..', `${basename(glb).replace(/\.glb$/i, '')}.height-${resolution}.json`)
      }

      function onChange(file: string, removed = false) {
        if (!file.startsWith(dir + sep)) return
        if (basename(file).startsWith('.')) return
        // The bake's own outputs. macOS reports them ~1.5 s after the bake exits,
        // which would reload the page a second time.
        if (BAKE_OUTPUT.test(file)) return
        if (terrain.test(file) && !removed) queueBake(file)
        else scheduleReload()
      }

      // A GLB dropped in while the server was down has no height field yet, or an old one
      function bakeStale(folder: string) {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
          const path = join(folder, entry.name)
          if (entry.isDirectory()) bakeStale(path)
          else if (terrain.test(path)) {
            const json = heightFieldFor(path)
            if (!existsSync(json) || statSync(json).mtimeMs < statSync(path).mtimeMs) queueBake(path)
          }
        }
      }
      if (existsSync(dir)) bakeStale(dir)

      server.watcher.add(dir)
      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
      server.watcher.on('unlink', file => onChange(file, true))
    },
  }
}
