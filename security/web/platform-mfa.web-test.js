jest.mock('@/lib/supabase-client', () => ({ createClient: () => ({ auth: { mfa: mockMfa } }) }))
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { MfaForm } = require('@/components/mfa-form')
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mockRouter = { replace: jest.fn(), refresh: jest.fn() }
const mockMfa = { listFactors: jest.fn(), enroll: jest.fn(), unenroll: jest.fn(), challengeAndVerify: jest.fn(), getAuthenticatorAssuranceLevel: jest.fn() }
let root, container
const verified = { id: 'verified-factor', factor_type: 'totp', status: 'verified' }
const abandoned = { id: 'abandoned-factor', factor_type: 'totp', status: 'unverified' }
const list = (factors=[]) => ({ data: { all: factors, totp: factors.filter(f => f.status === 'verified') }, error: null })
async function render() { await act(async () => root.render(<MfaForm />)) }
async function click(text) { await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text)).click()) }
async function submit(code='123456') {
  await act(async () => {
    const input = container.querySelector('#mfa-code')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,code)
    input.dispatchEvent(new Event('input',{bubbles:true}))
  })
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})))
}
beforeEach(() => {
  jest.clearAllMocks()
  mockMfa.listFactors.mockResolvedValue(list())
  mockMfa.enroll.mockResolvedValue({ data: { id:'new-factor', totp: { qr_code:'data:image/svg+xml;base64,PHN2Zy8+', secret:'private-setup-key' } }, error:null })
  mockMfa.unenroll.mockResolvedValue({error:null})
  mockMfa.challengeAndVerify.mockResolvedValue({error:null})
  mockMfa.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal2'},error:null})
  container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it('enrolls only on explicit action, replaces abandoned setup and verifies before navigation',async () => {
  mockMfa.listFactors.mockResolvedValue(list([abandoned]))
  await render()
  expect(mockMfa.enroll).not.toHaveBeenCalled()
  await click('Set up authenticator')
  expect(mockMfa.unenroll).toHaveBeenCalledWith({factorId:'abandoned-factor'})
  expect(mockMfa.enroll).toHaveBeenCalledWith({factorType:'totp',issuer:'Tshelo'})
  expect(container.querySelector('img').alt).toContain('QR code')
  expect(mockRouter.replace).not.toHaveBeenCalled()
  await submit()
  expect(mockMfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'new-factor',code:'123456'})
  expect(mockRouter.replace).toHaveBeenCalledWith('/')
  expect(container.textContent).not.toContain('private-setup-key')
})

it('challenges an existing verified factor without reenrollment',async () => {
  mockMfa.listFactors.mockResolvedValue(list([verified]))
  await render(); await submit()
  expect(mockMfa.enroll).not.toHaveBeenCalled()
  expect(mockMfa.unenroll).not.toHaveBeenCalled()
  expect(mockMfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'verified-factor',code:'123456'})
  expect(mockRouter.refresh).toHaveBeenCalled()
})

it('rejects invalid or expired challenges and permits retry',async () => {
  mockMfa.listFactors.mockResolvedValue(list([verified]))
  mockMfa.challengeAndVerify.mockResolvedValueOnce({error:new Error('expired')})
  await render(); await submit()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(container.querySelector('#mfa-code').value).toBe('')
  expect(container.textContent).toContain('Verification failed')
  await submit('654321')
  expect(mockRouter.replace).toHaveBeenCalledWith('/')
})

it('never opens the dashboard when assurance stays aal1',async () => {
  mockMfa.listFactors.mockResolvedValue(list([verified]))
  mockMfa.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal1'},error:null})
  await render(); await submit()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Verification failed')
})

it('fails closed when factor lookup fails and provides a POST sign-out',async () => {
  mockMfa.listFactors.mockRejectedValue(new Error('offline'))
  await render()
  expect(container.textContent).toContain('could not be loaded')
  expect(container.querySelector('#mfa-code')).toBeNull()
  expect(container.querySelector('form[action="/logout"]').method).toBe('post')
})

it('does not remove a verified factor discovered during enrollment',async () => {
  mockMfa.listFactors.mockResolvedValueOnce(list()).mockResolvedValue(list([verified]))
  await render(); await click('Set up authenticator')
  expect(mockMfa.unenroll).not.toHaveBeenCalled()
  expect(mockMfa.enroll).not.toHaveBeenCalled()
  await submit()
  expect(mockMfa.challengeAndVerify).toHaveBeenCalledWith({factorId:'verified-factor',code:'123456'})
})
