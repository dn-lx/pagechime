import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export const digest = value => createHash('sha256').update(value).digest('hex')
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
export const text = value => typeof value === 'string' && value.trim().length > 0
export function requireThat(condition, message) {
  if (!condition) throw new Error(message)
}
export function keys(value, allowed, label) {
  requireThat(object(value), `${label} must be an object`)
  requireThat(Object.keys(value).every(key => allowed.includes(key)), `${label} has unknown fields`)
}
export function unique(values, label) {
  requireThat(new Set(values).size === values.length, `${label} contains duplicates`)
}

// This guards accidental path escapes. It is not containment for hostile project code.
export async function readDocument(root, name, maxBytes = 1024 * 1024) {
  requireThat(text(name) && !isAbsolute(name), 'Input must be a repository-relative path')
  const base = await realpath(root), path = resolve(base, name), rel = relative(base, path)
  requireThat(rel !== '..' && !rel.startsWith(`..${sep}`), 'Input escapes repository')
  const stat = await lstat(path)
  requireThat(stat.isFile() && !stat.isSymbolicLink(), 'Input must be a regular file')
  const actual = relative(base, await realpath(path))
  requireThat(actual !== '..' && !actual.startsWith(`..${sep}`), 'Input resolves outside repository')
  requireThat(stat.size <= maxBytes, 'Input exceeds size limit')
  const bytes = await readFile(path)
  requireThat(bytes.length <= maxBytes, 'Input exceeds size limit')
  let value
  try { value = JSON.parse(bytes.toString('utf8')) }
  catch { throw new Error('Invalid JSON input; inspect the file locally') }
  return { value, sha256: digest(bytes) }
}

export async function artifactTarget(root, name) {
  requireThat(typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}\.json$/.test(name), 'Artifact name must be a simple .json filename')
  const dir = join(await realpath(root), '.agent-artifacts')
  try {
    const stat = await lstat(dir)
    requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'Artifact directory must not be a symlink')
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  const path = join(dir, name)
  try { await lstat(path); throw new Error('Artifact already exists; use a new name') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  return { dir, path }
}

export async function writeArtifact(root, name, value) {
  const { dir, path } = await artifactTarget(root, name)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  return path
}

export function options(args, valued, switches = []) {
  const result = {}
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    requireThat([...valued, ...switches].includes(key) && !(key in result), `Unknown or repeated option: ${key}`)
    if (switches.includes(key)) result[key] = true
    else {
      requireThat(text(args[i + 1]) && !args[i + 1].startsWith('--'), `Missing value: ${key}`)
      result[key] = args[++i]
    }
  }
  return result
}
