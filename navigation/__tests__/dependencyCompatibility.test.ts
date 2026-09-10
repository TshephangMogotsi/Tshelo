import { getPathFromState, getStateFromPath } from '@react-navigation/core'
import { parseInvitationUrl } from '../../shared/invitations'
import { appLinking } from '../linking'

// Use the real React Navigation -> query-string -> decoder chain, not mocks.
describe('patched navigation dependency compatibility', () => {
  it.each([
    ['event', 'JoinEvent', 'EVT-A1B2C3D4'],
    ['fund', 'JoinFund', 'FND-A1B2C3D4'],
  ])('round-trips %s invitation paths and Unicode query values', (kind, screen, code) => {
    const path = `/invite/${kind}/${code}?note=Dumela%20%E2%9C%93%20%2B`
    const state = getStateFromPath(path, appLinking.config)
    expect(state).toBeDefined()
    expect(state?.routes[0]).toMatchObject({ name: screen, params: { code, note: 'Dumela ✓ +' } })
    const serialized = getPathFromState(state!, appLinking.config)
    expect(getStateFromPath(serialized, appLinking.config)?.routes[0].params).toEqual(state?.routes[0].params)
  })

  it('preserves duplicate query parsing and React Navigation\'s default array stringification', () => {
    const state = getStateFromPath('/invite/event/EVT-A1B2C3D4?tag=one&tag=two', appLinking.config)
    expect(state?.routes[0].params).toMatchObject({ tag: ['one', 'two'] })
    // React Navigation stringifies non-string params before query-string sees
    // them. Arrays therefore serialize as a comma-separated string by default.
    expect(getPathFromState(state!, appLinking.config)).toBe('/invite/event/EVT-A1B2C3D4?tag=one%2Ctwo')
  })

  it('preserves literal plus signs, form spaces, empty values and flags', () => {
    const state = getStateFromPath('/invite/event/EVT-A1B2C3D4?note=a+b%2Bc&empty=&flag', appLinking.config)
    expect(state?.routes[0].params).toEqual({ code: 'EVT-A1B2C3D4', note: 'a b+c', empty: '', flag: null })
  })

  it('tolerates malformed query escapes while preserving valid fields', () => {
    const state = getStateFromPath('/invite/event/EVT-A1B2C3D4?bad=%80%E0%A4&note=Dumela', appLinking.config)
    expect(state?.routes[0].params).toMatchObject({ code: 'EVT-A1B2C3D4', note: 'Dumela' })
  })

  it('keeps query code overrides out of the actual custom invitation flow', () => {
    expect(parseInvitationUrl('https://app.tshelo.com/invite/event/EVT-A1B2C3D4?code=EVT-ATTACKER')).toEqual({ kind: 'event', code: 'EVT-A1B2C3D4' })
  })

  it('retains custom incoming-link validation', () => {
    expect(parseInvitationUrl('https://app.tshelo.com/invite/event/EVT-A1B2C3D4?bad=%80')).toEqual({ kind: 'event', code: 'EVT-A1B2C3D4' })
    expect(parseInvitationUrl('tshelo://join/FND-A1B2C3D4')).toEqual({ kind: 'fund', code: 'FND-A1B2C3D4' })
    expect(parseInvitationUrl('https://app.tshelo.com/invite/event/%80')).toBeNull()
    expect(parseInvitationUrl('https://evil.example/invite/event/EVT-A1B2C3D4')).toBeNull()
  })
})
