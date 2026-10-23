jest.mock('@/lib/api-client', () => ({ createApiClient: () => ({ users: mockUsers }) }))
jest.mock('@/components/account-theme', () => ({ useAccountThemePreference: () => 'system', setAccountThemePreference: jest.fn() }))

const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { AccountPreferences } = require('@/components/account-preferences/account-preferences')
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mockUsers = { me: jest.fn(), updateMe: jest.fn() }
const profile = { id: 'user', phone: '+26770000601', notifications_enabled: true, marketing_email_enabled: true, marketing_sms_enabled: false, marketing_consent: true, data_processing_consent: true }
let root, container
function toggle(title) {
  const row = [...document.querySelectorAll('.member-preference-switch-row')].find(node => node.textContent.includes(title))
  return row.querySelector('button')
}
async function save() {
  await act(async () => [...document.querySelectorAll('button')].find(node => node.textContent.includes('Save communication')).click())
}
beforeEach(async () => {
  jest.clearAllMocks(); mockUsers.me.mockResolvedValue(profile)
  mockUsers.updateMe.mockImplementation(async patch => ({ ...profile, ...patch }))
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<AccountPreferences />))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it('sends channel changes while aggregate marketing remains enabled', async () => {
  await act(async () => toggle('SMS').click()); await save()
  expect(mockUsers.updateMe).toHaveBeenCalledWith({ notifications_enabled: true, marketing_consent: true, marketing_email_enabled: true, marketing_sms_enabled: true })
  expect(document.querySelector('[role=status]').textContent).toContain('saved')
})

it('sends explicit aggregate withdrawal when the last visible marketing channel is disabled', async () => {
  await act(async () => toggle('Email').click()); await save()
  expect(mockUsers.updateMe).toHaveBeenCalledWith({ notifications_enabled: true, marketing_consent: false, marketing_email_enabled: false, marketing_sms_enabled: false })
  expect(toggle('Email').getAttribute('aria-checked')).toBe('false')
})
