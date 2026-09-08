import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url))
const { getAssetData, getAssetSize } = require('metro/private/Assets')

test('patched Metro reads the existing PNG assets through size and bundling APIs', async () => {
  const assetPath = path.join(root, 'assets/image-1.png')
  const content = fs.readFileSync(assetPath)
  const dimensions = { width: content.readUInt32BE(16), height: content.readUInt32BE(20) }
  assert.deepEqual(getAssetSize('png', content, assetPath), dimensions)
  const asset = await getAssetData(assetPath, 'image-1.png', [], null, '/assets')
  assert.equal(asset.width, dimensions.width)
  assert.equal(asset.height, dimensions.height)
  assert.equal(asset.type, 'png')
  assert.deepEqual(asset.scales, [1])
})

// These unsupported formats used to be detected by magic bytes even when
// disguised with a supported extension. A separate process bounds regressions
// to the old zero-length-box infinite loops, instead of hanging the test runner.
for (const [format, hex] of [
  ['ICNS', '69636e73000000106963703000000000'],
  ['JXL', '0000000c4a584c200d0a870a000000006a786c63'],
  ['HEIF', '000000186674797068656963000000006d69663168656963000000006d657461'],
]) {
  test(`rejects malformed ${format} bytes disguised as a PNG without hanging`, () => {
    execFileSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict')
      const { getAssetSize } = require('metro/private/Assets')
      assert.throws(() => getAssetSize('png', Buffer.from(process.argv[1], 'hex'), 'spoofed.png'))
    `, hex], { cwd: root, timeout: 5000, stdio: 'pipe' })
  })
}

test('the lockfile contains no external image-size dependency', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  assert.equal(Object.keys(lock.packages).some(key => key.endsWith('/image-size')), false)
})
