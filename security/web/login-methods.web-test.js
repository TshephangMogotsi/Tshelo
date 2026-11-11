jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/supabase-client', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/api-client', () => ({ createApiClient: jest.fn() }))

const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { LoginForm } = require('@/components/login-form')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

it('switches between mobile and email sign-in without submitting the form', async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(<LoginForm />))
  const buttons = [...container.querySelectorAll('.sign-in-method')]
  expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
  expect(container.querySelector('#phone')).not.toBeNull()
  await act(async () => buttons[1].click())
  expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  expect(container.querySelector('#email')).not.toBeNull()
  expect(container.querySelector('#phone')).toBeNull()
  await act(async () => buttons[0].click())
  expect(container.querySelector('#phone')).not.toBeNull()
  await act(async () => root.unmount())
  container.remove()
})


it('submits an eight-digit email code without truncating it', async () => {
  const { createClient } = require('@/lib/supabase-client')
  const verifyOtp = jest.fn().mockResolvedValue({ error: new Error('invalid test code') })
  createClient.mockReturnValue({ auth: { signInWithOtp: jest.fn().mockResolvedValue({ error: null }), verifyOtp } })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const setInput = async (selector, value) => {
    const input = container.querySelector(selector)
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  await act(async () => root.render(<LoginForm />))
  await act(async () => container.querySelectorAll('.sign-in-method')[1].click())
  await setInput('#email', 'admin@example.test')
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(container.querySelector('#code').maxLength).toBe(10)
  await setInput('#code', '12345')
  expect(container.querySelector('form button').disabled).toBe(true)
  await setInput('#code', '12345678')
  expect(container.querySelector('form button').disabled).toBe(false)
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(verifyOtp).toHaveBeenCalledWith({ email: 'admin@example.test', token: '12345678', type: 'email' })
  await act(async () => root.unmount())
  container.remove()
})
