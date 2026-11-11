jest.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }) }))
jest.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ userId: 'owner', userName: 'Test owner' }) }))
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../lib/useHardwareBack', () => ({ useHardwareBack: jest.fn() }))
jest.mock('../../../lib/useFundPermissions', () => ({ useFundPermissions: () => ({ can: () => true, isLoading: false }) }))
jest.mock('../../../lib/haptics', () => ({ hapticSuccess: jest.fn(), hapticError: jest.fn() }))
jest.mock('../../../lib/fundWorkspaceRefresh', () => ({ notifyFundWorkspaceChanged: jest.fn() }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')
jest.mock('../../../lib/api', () => ({ api: { funds: { listMembers: jest.fn() }, expenses: { create: jest.fn() } } }))
jest.mock('../recordExpense/receipt', () => ({ completeReceiptScan: jest.fn(), parseReceipt: jest.fn(), pickFromLibrary: jest.fn(), takePhoto: jest.fn(), uploadReceipt: jest.fn() }))
jest.mock('../recordExpense/ChooseMethodStep', () => 'ChooseMethod')
jest.mock('../recordExpense/ManualEntryStep', () => 'ManualEntry')
jest.mock('../recordExpense/ReviewStep', () => 'ReceiptReview')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert } = require('react-native')
const RecordExpenseScreen = require('../RecordExpenseScreen').default
const { api } = require('../../../lib/api')
const receipt = require('../recordExpense/receipt')
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const items = [{ name: 'Brown rice', amount: '25', category: { value: 'groceries' }, included: true }]
let tree
const navigation = { goBack: jest.fn() }
async function save(value = items) { await act(async () => tree.root.findByType('ReceiptReview').props.onSave('Reviewed shop', value)) }
beforeEach(async () => {
  jest.clearAllMocks(); jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  api.funds.listMembers.mockResolvedValue([])
  api.expenses.create.mockResolvedValue({ sponsorship_fulfilled: true })
  receipt.pickFromLibrary.mockResolvedValue('file://synthetic.jpg')
  receipt.parseReceipt.mockResolvedValue({ auditId: 'scan-1', objectPath: 'fund/owner/receipt.jpg', items: [] })
  receipt.completeReceiptScan.mockResolvedValue(undefined)
  await act(async () => { tree = create(<RecordExpenseScreen navigation={navigation} route={{ params: { fundId: 'fund', fundTitle: 'Test fund', currencyCode: 'BWP' } }} />) })
  await act(async () => tree.root.findByType('ChooseMethod').props.onUpload())
})
afterEach(async () => { await act(async () => tree.unmount()); jest.restoreAllMocks() })

it('sends the scan ID and reviewed edits before recording the matching expense', async () => {
  await save()
  expect(receipt.completeReceiptScan).toHaveBeenCalledWith('scan-1', { vendor: 'Reviewed shop', items: [{ name: 'Brown rice', amount: 25, category: 'groceries' }] })
  expect(api.expenses.create).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ item_name: 'Brown rice', amount: '25', receipt_path: 'fund/owner/receipt.jpg' })] }))
  expect(navigation.goBack).toHaveBeenCalledTimes(1)
})

it('prevents saving when audit completion fails and permits a retry', async () => {
  receipt.completeReceiptScan.mockRejectedValueOnce(new Error('Audit unavailable'))
  await save()
  expect(api.expenses.create).not.toHaveBeenCalled()
  expect(Alert.alert).toHaveBeenCalledWith('Could not save expense', 'Audit unavailable')
  await save()
  expect(api.expenses.create).toHaveBeenCalledTimes(1)
})

it('retries an expense failure without repeating immutable audit completion', async () => {
  api.expenses.create.mockRejectedValueOnce(new Error('Expense unavailable'))
  await save(); await save()
  expect(receipt.completeReceiptScan).toHaveBeenCalledTimes(1)
  expect(api.expenses.create).toHaveBeenCalledTimes(2)
})

it('does not save changed edits under a previously confirmed audit snapshot', async () => {
  api.expenses.create.mockRejectedValueOnce(new Error('Expense unavailable'))
  await save(); await save([{ ...items[0], amount: '30' }])
  expect(api.expenses.create).toHaveBeenCalledTimes(1)
  expect(Alert.alert).toHaveBeenLastCalledWith('Could not save expense', expect.stringContaining('start a new scan'))
})
