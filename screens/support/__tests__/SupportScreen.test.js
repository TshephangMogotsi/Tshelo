jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))

const mockSubmitSupportReport = jest.fn()
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../lib/api', () => ({ api: { users: { submitSupportReport: mockSubmitSupportReport } } }))
jest.mock('../../../lib/apiScreen', () => ({ toApiUiError: error => ({ message: error.message || 'Please try again.' }) }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: jest.fn() }) }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text, TextInput } = require('react-native')
const SupportScreen = require('../SupportScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree

beforeEach(() => {
  jest.clearAllMocks()
  mockSubmitSupportReport.mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    ticket_number: 'TSH-1001',
    status: 'open',
    created_at: '2026-10-02T08:00:00.000Z',
  })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
})

function hasText(label) {
  return tree.root.findAllByType(Text).some(text => text.props.children === label)
}

it('submits an authenticated structured report and confirms its ticket number', async () => {
  await act(async () => { tree = create(React.createElement(SupportScreen)) })

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'App problem' }).props.onPress())
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Reports fail after I select a fund.') )
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Send report' }).props.onPress()
    await Promise.resolve()
  })

  expect(mockSubmitSupportReport).toHaveBeenCalledWith(expect.objectContaining({
    category: 'technical',
    description: 'Reports fail after I select a fund.',
  }))
  expect(hasText('Report received')).toBe(true)
  expect(hasText('TSH-1001')).toBe(true)
})

it('keeps submission unavailable until the user chooses a category and writes enough detail', async () => {
  await act(async () => { tree = create(React.createElement(SupportScreen)) })
  expect(tree.root.findByProps({ accessibilityLabel: 'Send report' }).props.disabled).toBe(true)

  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Suggestion' }).props.onPress())
  await act(async () => tree.root.findByType(TextInput).props.onChangeText('Too short'))
  expect(tree.root.findByProps({ accessibilityLabel: 'Send report' }).props.disabled).toBe(true)
})
