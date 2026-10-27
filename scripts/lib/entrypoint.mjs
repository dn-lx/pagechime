import { realpathSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Node resolves module symlinks but argv may retain the caller's path spelling.
// Compare file identity so direct, relative and aliased CLI invocations agree.
export function isMainModule(moduleUrl, argvPath = process.argv[1]) {
  if (typeof argvPath !== 'string' || !argvPath) return false
  try {
    const modulePath = fileURLToPath(moduleUrl), entryPath = resolve(argvPath)
    const moduleStat = statSync(modulePath, { bigint: true }), entryStat = statSync(entryPath, { bigint: true })
    if (!moduleStat.isFile() || !entryStat.isFile()) return false
    if (moduleStat.ino > 0n && entryStat.ino > 0n) return moduleStat.dev === entryStat.dev && moduleStat.ino === entryStat.ino
    return realpathSync.native(modulePath) === realpathSync.native(entryPath)
  } catch { return false }
}
