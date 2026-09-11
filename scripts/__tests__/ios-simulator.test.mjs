import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'
import test from 'node:test'
import {
  buildXcodeArguments,
  chooseBootedIosSimulator,
  isSupportedNodeVersion,
} from '../run-ios-simulator.mjs'

const require = createRequire(import.meta.url)
const { observeFileChanges } = require('../../node_modules/expo/node_modules/@expo/cli/build/src/start/server/metro/waitForMetroToObserveTypeScriptFile.js')

test('accepts the supported Node LTS release lines', () => {
  assert.equal(isSupportedNodeVersion('v20.19.0'), true)
  assert.equal(isSupportedNodeVersion('v22.22.0'), true)
  assert.equal(isSupportedNodeVersion('v24.19.0'), true)
  assert.equal(isSupportedNodeVersion('v20.18.3'), false)
  assert.equal(isSupportedNodeVersion('v26.7.0'), false)
})

test('chooses the most recently booted available iOS simulator', () => {
  const selected = chooseBootedIosSimulator({
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
        { udid: 'older', name: 'iPhone 16', state: 'Booted', isAvailable: true, lastBootedAt: '2026-09-10T10:00:00Z' },
        { udid: 'newer', name: 'iPhone 17', state: 'Booted', isAvailable: true, lastBootedAt: '2026-09-11T10:00:00Z' },
        { udid: 'unavailable', name: 'iPhone 15', state: 'Booted', isAvailable: false, lastBootedAt: '2026-09-12T10:00:00Z' },
      ],
      'com.apple.CoreSimulator.SimRuntime.tvOS-26-0': [
        { udid: 'tv', name: 'Apple TV', state: 'Booted', isAvailable: true, lastBootedAt: '2026-09-13T10:00:00Z' },
      ],
    },
  })

  assert.equal(selected.udid, 'newer')
})

test('uses ad-hoc simulator signing without removing production entitlements', () => {
  const args = buildXcodeArguments('simulator-id')
  assert.ok(args.includes('-quiet'))
  assert.ok(args.includes('id=simulator-id'))
  assert.ok(args.includes('CODE_SIGN_IDENTITY=-'))
  assert.ok(args.includes('CODE_SIGNING_ALLOWED=YES'))
  assert.ok(args.includes('CODE_SIGNING_REQUIRED=YES'))
  assert.equal(args.includes('CODE_SIGNING_ALLOWED=NO'), false)
})

test('patched Expo CLI accepts the current Metro file-change shape', () => {
  const watcher = new EventEmitter()
  const server = new EventEmitter()
  const watchedFile = '/tmp/tshelo/.env.local'
  let calls = 0
  const off = observeFileChanges({
    metro: {
      getBundler: () => ({
        getBundler: () => ({ getWatcher: () => watcher }),
      }),
    },
    server,
  }, [watchedFile], () => { calls += 1 })

  watcher.emit('change', {
    changes: {
      addedFiles: [],
      modifiedFiles: [[watchedFile, { isSymlink: false, modifiedTime: Date.now() }]],
      removedFiles: [],
    },
  })

  assert.equal(calls, 1)
  off()
})
