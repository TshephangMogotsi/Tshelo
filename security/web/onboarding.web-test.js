jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/api-client', () => ({ createApiClient: () => ({ users: { updateMe: mockUpdate } }) }))
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { InvitationOnboardingForm } = require('@/components/invitation-onboarding-form')
const mockUpdate = jest.fn()
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container
const button = text => [...container.querySelectorAll('button')].find(el => el.textContent.trim() === text)
async function click(text) { await act(async () => button(text).click()) }
async function input(id, value) { await act(async () => { const node = container.querySelector(id); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })) }) }
async function submit() { await act(async () => container.querySelector('.onboarding-card form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
async function profile() { await input('#onboarding-name', 'Test Person'); await act(async () => container.querySelector('.profile-consent input').click()); await submit() }
beforeEach(async () => { mockUpdate.mockReset().mockResolvedValue({}); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); await act(async () => root.render(<InvitationOnboardingForm phone="" email="tester@example.test" />)) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it('records consent first and allows payment details to be skipped', async () => {
  await profile()
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Person', data_processing_consent: true }))
  expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('profile_completed')
  expect(container.textContent).toContain('A verified mobile number is needed')
  await click('Continue')
  expect(container.textContent).toContain('No bank account added')
  await submit()
  expect(container.textContent).toContain('You’re all set!')
  expect(mockUpdate).toHaveBeenCalledTimes(1)
})

it('requires ownership confirmation before saving optional bank details', async () => {
  await profile()
  await click('Add a bank account')
  await act(async () => { const select = container.querySelector('#onboarding-bank'); select.value = 'ABSA'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  await input('#onboarding-account', '12345678')
  await click('Continue')
  expect(container.textContent).toContain('Account ending 5678')
  expect(button('Confirm & continue').disabled).toBe(true)
  await act(async () => container.querySelector('.profile-consent input').click())
  await submit()
  expect(mockUpdate).toHaveBeenLastCalledWith({ bank_name: 'ABSA', bank_branch_code: '290099', bank_account_number: '12345678' })
  expect(container.textContent).toContain('You’re all set!')
})

it('marks onboarding complete only after the final action and allows a retry on failure', async () => {
  await profile()
  await click('Continue')
  await submit()
  mockUpdate.mockRejectedValueOnce(new Error('unavailable'))
  await click('Get started')
  expect(mockUpdate).toHaveBeenLastCalledWith({ profile_completed: true, onboarding_completed: true })
  expect(container.textContent).toContain('You’re all set!')
  expect(button('Get started').disabled).toBe(false)
})
