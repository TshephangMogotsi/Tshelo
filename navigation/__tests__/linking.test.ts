import { appLinking } from '../linking'

describe('app deep links', () => {
  it('registers the production HTTPS host and legacy app schemes', () => {
    expect(appLinking.prefixes).toEqual(['https://app.tshelo.com', 'tshelo://', 'exp+tshelo://'])
  })

  it('routes canonical fund invitation paths to the fund join flow', () => {
    expect(appLinking.config.screens.JoinFund).toBe('invite/fund/:code')
  })

  it('routes canonical event invitation paths to the event join flow', () => {
    expect(appLinking.config.screens.JoinEvent).toBe('invite/event/:code')
  })
})
