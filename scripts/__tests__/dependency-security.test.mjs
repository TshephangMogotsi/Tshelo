import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const require = createRequire(import.meta.url)
// Resolve from the actual consumers, so a safe hoisted copy cannot hide a
// vulnerable nested dependency that React Navigation or Expo still loads.
const navigationRequire = createRequire(require.resolve('@react-navigation/core'))
const queryRequire = createRequire(navigationRequire.resolve('query-string'))
const expoRequire = createRequire(require.resolve('@expo/config-plugins'))
const xcodeRequire = createRequire(expoRequire.resolve('xcode'))
const queryString = navigationRequire('query-string')
const uuid = xcodeRequire('uuid')

test('consumer paths resolve only the pinned patched decoder and UUID', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  for (const [name, version] of [['decode-uri-component', '0.5.0'], ['uuid', '11.1.1']]) {
    const copies = Object.entries(lock.packages).filter(([key]) => key.endsWith(`/node_modules/${name}`) || key === `node_modules/${name}`)
    assert.ok(copies.length > 0, `${name} missing from the lockfile`)
    for (const [key, pkg] of copies) assert.equal(pkg.version, version, key)
  }
  const decoderPackage = JSON.parse(readFileSync(path.join(path.dirname(queryRequire.resolve('decode-uri-component')), 'package.json'), 'utf8'))
  assert.equal(decoderPackage.version, '0.5.0')
  assert.equal(xcodeRequire('uuid/package.json').version, '11.1.1')
})

test('no locked js-yaml copy is in the vulnerable 3.x range', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  const copies = Object.entries(lock.packages).filter(([key]) => key.endsWith('/node_modules/js-yaml') || key === 'node_modules/js-yaml')
  assert.ok(copies.length > 0, 'js-yaml missing from the lockfile')
  for (const [key, pkg] of copies) {
    assert.ok(pkg.version === '3.15.2' || pkg.version.startsWith('4.'), `${key}: ${pkg.version}`)
  }
})

test('query-string consumes the patched ESM decoder from CommonJS', () => {
  assert.equal(typeof queryRequire('decode-uri-component').default, 'function')
  assert.deepEqual({ ...queryString.parse('name=Tshelo+event&plus=%2B&note=%E2%9C%93&empty=&flag&tag=a&tag=b') }, {
    name: 'Tshelo event', plus: '+', note: '✓', empty: '', flag: null, tag: ['a', 'b'],
  })
})

test('query parsing and serialization preserve navigation values and order', () => {
  const params = { code: 'EVT-A1B2C3D4', note: 'Dumela ✓ + 100%', tag: ['one', 'two'] }
  const encoded = queryString.stringify(params, { sort: false })
  assert.equal(encoded, 'code=EVT-A1B2C3D4&note=Dumela%20%E2%9C%93%20%2B%20100%25&tag=one&tag=two')
  assert.deepEqual({ ...queryString.parse(encoded) }, params)
  assert.deepEqual({ ...queryString.parse('literal=a+b%20c', { decode: false }) }, { literal: 'a+b%20c' })
})

// Execute malicious input only in an isolated, short-lived local process.
// A regressed recursive decoder must fail the test instead of hanging CI.
for (const [name, fragment] of [['invalid continuation bytes', '%80'], ['truncated UTF-8', '%E0%A4'], ['mixed valid and invalid UTF-8', '%41%80']]) {
  test(`malformed URI decoding is bounded: ${name}`, () => {
    execFileSync(process.execPath, ['-e', `
      const assert = require('node:assert/strict')
      const queryString = require('query-string')
      const value = process.argv[1].repeat(4096)
      const result = queryString.parse('note=' + value + '&code=EVT-A1B2C3D4')
      assert.equal(result.code, 'EVT-A1B2C3D4')
      assert.equal(typeof result.note, 'string')
      assert.ok(result.note.length > 0)
      assert.equal(queryString.parse('name=Dumela%20world').name, 'Dumela world')
    `, fragment], { cwd: root, timeout: 5000, stdio: 'pipe' })
  })
}

test('malformed escapes stay non-throwing and query keys cannot pollute prototypes', () => {
  const result = queryString.parse('bad=%G1%&__proto__=blocked&constructor=plain&valid=%F0%9F%93%8E')
  assert.equal(result.bad, '%G1%')
  assert.equal(result.valid, '📎')
  assert.equal(Object.getPrototypeOf(result), null)
  assert.equal(Object.hasOwn(result, '__proto__'), true)
  assert.equal(Object.prototype.blocked, undefined)
})

const namespaced = name => (buffer, offset) => uuid[name]('tshelo.example', uuid[name].DNS, buffer, offset)
for (const [name, generate] of [['v3', namespaced('v3')], ['v5', namespaced('v5')], ['v6', (buffer, offset) => uuid.v6({}, buffer, offset)]]) {
  test(`${name} rejects invalid output buffers without partial writes`, () => {
    for (const [length, offset] of [[8, 0], [16, 4], [16, -1]]) {
      const buffer = new Uint8Array(length).fill(0xaa)
      assert.throws(() => generate(buffer, offset), RangeError)
      assert.deepEqual(buffer, new Uint8Array(length).fill(0xaa))
    }
  })

  test(`${name} still supports valid buffers and offsets`, () => {
    const buffer = new Uint8Array(24).fill(0xaa)
    assert.equal(generate(buffer, 4), buffer)
    assert.deepEqual(buffer.subarray(0, 4), new Uint8Array(4).fill(0xaa))
    assert.deepEqual(buffer.subarray(20), new Uint8Array(4).fill(0xaa))
    const value = uuid.stringify(buffer, 4)
    assert.equal(uuid.validate(value), true)
    assert.equal(uuid.version(value), Number(name.slice(1)))
  })
}

test('Expo Xcode project edits still generate valid IDs and round-trip', () => {
  const xcode = expoRequire('xcode')
  const project = xcode.project(path.join(root, 'security/fixtures/dependency-security.pbxproj')).parseSync()
  const originalIds = project.allUuids()
  const { IOSConfig } = require('@expo/config-plugins')
  const group = IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'SecurityChecks/Nested')
  assert.equal(group.name, 'Nested')
  assert.equal(IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'SecurityChecks/Nested'), group)
  const ids = project.allUuids()
  assert.equal(ids.length, originalIds.length + 2)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[0-9A-F]{24}$/)
  const serialized = project.writeSync()
  const reparsed = xcode.project('in-memory-only.pbxproj')
  reparsed.hash = expoRequire('xcode/lib/parser/pbxproj').parse(serialized)
  assert.deepEqual(reparsed.allUuids(), ids)
  assert.equal(reparsed.pbxGroupByName('Nested').name, 'Nested')
})

for (const platform of ['android', 'ios']) {
  test(`patched query decoding executes in a production Metro ${platform} bundle`, async () => {
    const { getDefaultConfig } = require('expo/metro-config')
    const { runBuild } = require('metro')
    const config = getDefaultConfig(root)
    // The CLI adds projectRoot to watchFolders during loadConfig; runBuild
    // consumes an already-normalized config directly.
    config.watchFolders = [root, ...config.watchFolders]
    config.maxWorkers = 2
    config.resolver.useWatchman = false
    config.reporter = { update() {} }
    config.cacheStores = []
    // This pure-JS fixture needs no native bootstrapping. Keep Expo's real
    // resolver/transformer but use Metro's plain JS serializer for VM execution.
    config.serializer.customSerializer = undefined
    config.serializer.getModulesRunBeforeMainModule = () => []
    config.serializer.getPolyfills = () => []
    const bundle = await runBuild(config, {
      entry: path.join(root, 'security/fixtures/dependency-security-entry.js'),
      platform, dev: false, minify: true,
    })
    const context = vm.createContext({ process: { env: { NODE_ENV: 'production' } } })
    vm.runInContext(bundle.code, context, { timeout: 5000 })
    assert.deepEqual(JSON.parse(JSON.stringify(context.__tsheloDependencyResult)), {
      note: 'Dumela ✓ +', code: 'EVT-A1B2C3D4', malformed: '%80'.repeat(4096),
      serialized: 'note=Dumela%20%E2%9C%93%20%2B',
    })
  })
}
