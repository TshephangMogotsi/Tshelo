import { appLinking } from '../linking'

describe('app deep links', () => {
  it('routes fund invitation codes to the fund join flow', () => {
    expect(appLinking.config.screens.JoinFund).toBe('join/:code')
  })

  it('routes event invitation codes to the event join flow', () => {
    expect(appLinking.config.screens.JoinEvent).toBe('event/:code')
  })
})
