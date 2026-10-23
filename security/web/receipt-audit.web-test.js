jest.mock('@/lib/api-client', () => ({ createApiClient: () => mockApi }))

const React = require('react')
const { act } = React
const { createRoot } = require('react-dom/client')
const { FundExpenses } = require('@/components/account-funds/fund-finances')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mockApi = {
  receipts: { createUploadSession: jest.fn(), parse: jest.fn(), completeScan: jest.fn() },
  expenses: { create: jest.fn() },
}
const data = {
  user: { id: 'owner' },
  workspace: { fund: { id: 'fund', owner_id: 'owner', status: 'active', currency_code: 'BWP' }, permissions: [], members: [], expenses: [], sponsorship_items: [] },
}
const parsed = { audit_id: 'scan-1', is_receipt: true, vendor: 'Test shop', total: '20', items: [{ name: 'Rice', amount: '20', category: 'groceries' }] }
let root, container, originalFetch, originalBitmap
const reload = jest.fn()
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === label)
async function submit() {
  await act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
}
async function change(selector, value) {
  await act(async () => {
    const node = document.querySelector(selector)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function attach(result = parsed) {
  mockApi.receipts.parse.mockResolvedValue(result)
  await act(async () => button('Record expense').click())
  await act(async () => {
    const input = document.querySelector('input[type=file]')
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['synthetic image'], 'receipt.jpg', { type: 'image/jpeg' })] })
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}
beforeEach(async () => {
  jest.clearAllMocks()
  originalFetch = global.fetch; originalBitmap = global.createImageBitmap
  global.fetch = jest.fn().mockResolvedValue({ ok: true })
  global.createImageBitmap = jest.fn().mockResolvedValue({ width: 100, height: 100, close: jest.fn() })
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() })
  jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpeg'], { type: 'image/jpeg' })))
  mockApi.receipts.createUploadSession.mockResolvedValue({ object_path: 'fund/owner/receipt.jpg', upload_url: 'https://storage.test/upload', content_type: 'image/jpeg' })
  mockApi.receipts.completeScan.mockResolvedValue({})
  mockApi.expenses.create.mockResolvedValue({ sponsorship_fulfilled: true })
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
  await act(async () => root.render(<FundExpenses data={data} reload={reload} />))
})
afterEach(async () => {
  await act(async () => root.unmount()); container.remove()
  global.fetch = originalFetch; global.createImageBitmap = originalBitmap
  jest.restoreAllMocks()
})

it('keeps the scan ID and records reviewed edits before saving receipt expenses', async () => {
  await attach()
  await change('[aria-label="Item 1 name"]', 'Brown rice')
  await change('[aria-label="Item 1 amount"]', '25')
  await submit()
  expect(mockApi.receipts.completeScan).toHaveBeenCalledWith({ audit_id: 'scan-1', user_edits: { vendor: 'Test shop', items: [{ name: 'Brown rice', amount: 25, category: 'groceries' }] } })
  expect(mockApi.expenses.create).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ item_name: 'Brown rice', amount: '25', receipt_path: 'fund/owner/receipt.jpg' })] }))
  expect(mockApi.receipts.completeScan.mock.invocationCallOrder[0]).toBeLessThan(mockApi.expenses.create.mock.invocationCallOrder[0])
  expect(reload).toHaveBeenCalledTimes(1)
})

it('keeps the form and prevents expense creation when audit completion fails', async () => {
  await attach()
  mockApi.receipts.completeScan.mockRejectedValueOnce(new Error('Audit unavailable'))
  await submit()
  expect(mockApi.expenses.create).not.toHaveBeenCalled()
  expect(document.querySelector('[role=alert]').textContent).toContain('Something went wrong. Please try again.')
  await submit()
  expect(mockApi.expenses.create).toHaveBeenCalledTimes(1)
})

it('does not repeat immutable audit completion when expense creation is retried', async () => {
  await attach()
  mockApi.expenses.create.mockRejectedValueOnce(new Error('Expense unavailable'))
  await submit()
  expect(document.querySelector('fieldset').disabled).toBe(true)
  await submit()
  expect(mockApi.receipts.completeScan).toHaveBeenCalledTimes(1)
  expect(mockApi.expenses.create).toHaveBeenCalledTimes(2)
})

it('retains audit IDs for unrecognised images reviewed manually', async () => {
  await attach({ ...parsed, is_receipt: false, items: [] })
  await change('label input[type=number]', '12')
  const fields = document.querySelectorAll('.member-form-grid label input')
  await act(async () => {
    for (const node of fields) {
      if (node.type === 'number') continue
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, 'Manual review')
      node.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })
  await submit()
  expect(mockApi.receipts.completeScan).toHaveBeenCalledWith(expect.objectContaining({ audit_id: 'scan-1' }))
})

it('clears the old scan ID when the receipt is discarded', async () => {
  await attach(); await act(async () => button('Clear').click())
  await submit()
  expect(mockApi.receipts.completeScan).not.toHaveBeenCalled()
})
