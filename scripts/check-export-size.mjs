import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const MEBIBYTE = 1024 * 1024
const MAX_EXPORT_BYTES = 11 * MEBIBYTE
const MAX_BUNDLE_BYTES = 5.5 * MEBIBYTE
const root = process.cwd()
const exportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'tshelo-android-export-'))

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath]
  })
}

function formatSize(bytes) {
  return `${(bytes / MEBIBYTE).toFixed(2)} MiB`
}

try {
  const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli')
  const result = spawnSync(
    process.execPath,
    [expoCli, 'export', '--platform', 'android', '--output-dir', exportDirectory],
    { cwd: root, env: process.env, stdio: 'inherit' },
  )
  if (result.error) throw result.error
if (result.status !== 0) {
  throw new Error(`Expo Android export failed with status ${result.status ?? 1}`)
}

  const exportedFiles = filesUnder(exportDirectory)
  const measuredFiles = exportedFiles.filter(file => !file.endsWith('.map'))
  const bundleFiles = measuredFiles.filter(file => file.endsWith('.hbc') || file.endsWith('.js'))
  const totalBytes = measuredFiles.reduce((total, file) => total + fs.statSync(file).size, 0)
  const bundleBytes = bundleFiles.reduce((total, file) => total + fs.statSync(file).size, 0)

  console.log(`Android export size: ${formatSize(totalBytes)} (limit ${formatSize(MAX_EXPORT_BYTES)})`)
  console.log(`Hermes/JS bundle size: ${formatSize(bundleBytes)} (limit ${formatSize(MAX_BUNDLE_BYTES)})`)

  const failures = []
  if (totalBytes > MAX_EXPORT_BYTES) failures.push('Android export exceeds its size budget')
  if (bundleBytes > MAX_BUNDLE_BYTES) failures.push('Hermes/JS bundle exceeds its size budget')
  if (bundleFiles.length !== 1) failures.push(`Expected one Android bundle, found ${bundleFiles.length}`)

  if (failures.length) {
    failures.forEach(failure => console.error(`FAIL: ${failure}`))
    process.exitCode = 1
  } else {
    console.log('Android export size budgets passed.')
  }
} finally {
  fs.rmSync(exportDirectory, { recursive: true, force: true })
}
