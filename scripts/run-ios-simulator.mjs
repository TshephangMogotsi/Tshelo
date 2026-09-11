import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const root = path.resolve(path.dirname(scriptPath), '..')
const preferredNodeVersion = '24.19.0'

export function isSupportedNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return false
  const [, major, minor] = match.map(Number)
  return (major === 20 && minor >= 19) || major === 22 || major === 24
}

export function chooseBootedIosSimulator(raw) {
  const payload = typeof raw === 'string' ? JSON.parse(raw) : raw
  const candidates = Object.entries(payload.devices ?? {})
    .filter(([runtime]) => runtime.includes('.iOS-'))
    .flatMap(([, devices]) => devices)
    .filter(device => device.state === 'Booted' && device.isAvailable !== false)
    .sort((left, right) => String(right.lastBootedAt ?? '').localeCompare(String(left.lastBootedAt ?? '')))

  return candidates[0] ?? null
}

export function buildXcodeArguments(deviceId) {
  return [
    '-quiet',
    '-workspace', 'ios/Tshelo.xcworkspace',
    '-scheme', 'Tshelo',
    '-configuration', 'Debug',
    '-sdk', 'iphonesimulator',
    '-destination', `id=${deviceId}`,
    '-derivedDataPath', 'ios/build/simulator',
    'CODE_SIGN_IDENTITY=-',
    'CODE_SIGNING_ALLOWED=YES',
    'CODE_SIGNING_REQUIRED=YES',
    'build',
  ]
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    env: options.env ?? process.env,
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  return result.stdout ?? ''
}

function reexecuteWithLtsIfNeeded() {
  if (isSupportedNodeVersion(process.version)) return false

  if (process.env.TSHELO_NODE_REEXEC === '1') {
    throw new Error(`Tshelo requires Node 20, 22, or 24 LTS; received ${process.version}.`)
  }

  console.log(`Node ${process.version} is not supported by this Expo release; retrying with Node ${preferredNodeVersion} via fnm.`)
  const result = spawnSync('fnm', [
    'exec', `--using=${preferredNodeVersion}`, 'node', scriptPath, ...process.argv.slice(2),
  ], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, TSHELO_NODE_REEXEC: '1' },
  })

  if (result.error?.code === 'ENOENT') {
    throw new Error(`Install Node ${preferredNodeVersion} LTS or activate it before running npm run ios.`)
  }
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

function main() {
  if (process.platform !== 'darwin') throw new Error('The iOS Simulator requires macOS.')
  if (reexecuteWithLtsIfNeeded()) return

  const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo
  const bundleIdentifier = appConfig.ios?.bundleIdentifier
  if (!bundleIdentifier) throw new Error('app.json is missing expo.ios.bundleIdentifier.')

  const simulator = chooseBootedIosSimulator(run('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], { capture: true }))
  if (!simulator) throw new Error('No booted iOS simulator was found. Open Simulator and try again.')

  console.log('Synchronising CocoaPods with the installed native packages.')
  run('pod', ['install', '--project-directory=ios', '--silent'])

  console.log(`Building Tshelo for ${simulator.name} (${simulator.udid}) with local simulator signing.`)
  run('xcodebuild', buildXcodeArguments(simulator.udid))

  const appPath = path.join(root, 'ios/build/simulator/Build/Products/Debug-iphonesimulator/Tshelo.app')
  if (!fs.existsSync(appPath)) throw new Error(`The simulator app was not produced at ${appPath}.`)

  run('xcrun', ['simctl', 'install', simulator.udid, appPath])

  if (process.argv.includes('--no-bundler')) {
    run('xcrun', ['simctl', 'launch', simulator.udid, bundleIdentifier])
    return
  }

  console.log('Starting Metro and opening Tshelo. Press Ctrl+C when you are finished.')
  run('npx', ['expo', 'start', '--dev-client', '--ios'])
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
