jest.mock('next/script', () => ({ __esModule: true, default: function MockScript(props) {
  const React = require('react')
  React.useEffect(() => { props.onReady() }, [])
  return null
} }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }) => <a href={href}>{children}</a> }))
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { CountryWaitlistForm } = require('@/components/country-waitlist-form')
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, container, options
const originalFetch = global.fetch
beforeEach(async () => {
  jest.clearAllMocks()
  window.turnstile = {
    render: jest.fn((_container, config) => { options = config; return 'widget-1' }),
    reset: jest.fn(), remove: jest.fn(),
  }
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'Your request has been received.' }) })
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<CountryWaitlistForm siteKey="public-site-key" countries={[{ code: 'KEN', name: 'Kenya' }]} enabled />))
  container.querySelector('select').value = 'KEN'
  container.querySelector('[type=email]').value = 'qa@example.invalid'
  container.querySelector('[type=checkbox]').checked = true
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); delete window.turnstile; global.fetch = originalFetch })
async function verify(token = 'single-use-token') { await act(async () => options.callback(token)) }
async function submit() { await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
it('requires verification, uses the expected action, and discloses purpose/retention', () => {
  expect(container.querySelector('button').disabled).toBe(true)
  expect(options).toMatchObject({ sitekey: 'public-site-key', action: 'country_waitlist' })
  expect(container.textContent).toContain('12 months')
  expect(container.querySelector('[type=checkbox]').required).toBe(true)
})
it('sends only the controlled API fields and shows generic success', async () => {
  await verify(); await submit()
  expect(global.fetch).toHaveBeenCalledTimes(1)
  const [path, request] = global.fetch.mock.calls[0]
  expect(path).toBe('/api/country-waitlist')
  expect(JSON.parse(request.body)).toEqual({ country_code: 'KEN', email: 'qa@example.invalid', captcha_token: 'single-use-token' })
  expect(container.querySelector('[role=status]').textContent).toContain('received')
  expect(window.turnstile.remove).toHaveBeenCalledWith('widget-1')
})
it('discards expired/error tokens and prevents submission', async () => {
  await verify(); await act(async () => options['expired-callback']())
  expect(container.querySelector('button').disabled).toBe(true)
  await verify(); await act(async () => options['error-callback']())
  expect(container.querySelector('button').disabled).toBe(true)
  await submit(); expect(global.fetch).not.toHaveBeenCalled()
})
it('requires a fresh token after a server rejection and preserves input', async () => {
  global.fetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'Please complete the verification again.' }) })
  await verify(); await submit()
  expect(window.turnstile.reset).toHaveBeenCalledWith('widget-1')
  expect(container.querySelector('button').disabled).toBe(true)
  expect(container.querySelector('[type=email]').value).toBe('qa@example.invalid')
  expect(container.querySelector('[role=alert]').textContent).toContain('again')
  await submit(); expect(global.fetch).toHaveBeenCalledTimes(1)
  await verify('fresh-token')
  expect(container.querySelector('[role=alert]').textContent).toContain('again')
})
it('keeps collection disabled even after successful verification', async () => {
  await act(async () => root.render(<CountryWaitlistForm siteKey="public-site-key" countries={[{ code: 'KEN', name: 'Kenya' }]} enabled={false} />))
  await verify(); await submit()
  expect(container.querySelector('button').disabled).toBe(true)
  expect(container.querySelector('fieldset').disabled).toBe(true)
  expect(container.querySelector('[role=status]').textContent).toContain('not open')
  expect(global.fetch).not.toHaveBeenCalled()
})
