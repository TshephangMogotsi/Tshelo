jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { StyleSheet, Text, TouchableOpacity } = require('react-native')
const FundCreatedScreen = require('../FundCreatedScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
let navigation

beforeEach(() => {
  navigation = {
    reset: jest.fn(),
    popToTop: jest.fn(),
  }
  act(() => {
    tree = create(React.createElement(FundCreatedScreen, {
      navigation,
      route: {
        params: {
          fundName: 'Test Fund',
          category: 'General',
          emoji: '💜',
          goalBWP: '10000',
          currencyCode: 'BWP',
          currencySymbol: 'P',
          targetDate: '2026-10-19',
          shareCode: 'FND-A17430F00F634D8CBA68',
          fundId: 'fund-id',
        },
      },
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

function textContent() {
  const content = value => Array.isArray(value)
    ? value.map(content).join('')
    : value == null ? '' : String(value)
  return tree.root.findAllByType(Text).map(node => content(node.props.children)).join(' ')
}

it('uses a compact checkmark heading without the decorative wallet or fund emoji', () => {
  const iconNames = tree.root.findAllByType('Icon').map(node => node.props.name)

  expect(iconNames).toContain('checkmark-circle')
  expect(iconNames).not.toContain('wallet')
  expect(textContent()).not.toContain('💜')
})

it('keeps a long invite code on one responsive selectable line', () => {
  const code = tree.root.findByProps({
    accessibilityLabel: 'Invite code FND-A17430F00F634D8CBA68',
  })

  expect(code.props.numberOfLines).toBe(1)
  expect(code.props.adjustsFontSizeToFit).toBe(true)
  expect(code.props.minimumFontScale).toBe(0.65)
  expect(code.props.selectable).toBe(true)
})

it('keeps the sharing screen focused by omitting the message preview', () => {
  expect(textContent()).not.toContain('Message preview')
  expect(textContent()).not.toContain("I'll invite people later")
})

it('provides a full-width action that opens the created fund', () => {
  const button = tree.root.findAllByType(TouchableOpacity).find(node => (
    node.props.accessibilityLabel === 'View Fund'
  ))

  expect(button).toBeDefined()
  expect(StyleSheet.flatten(button.props.style)).toMatchObject({ width: '100%' })

  act(() => button.props.onPress())
  expect(navigation.reset).toHaveBeenCalledWith({
    index: 1,
    routes: [
      { name: 'Tabs' },
      { name: 'FundDetail', params: { fundId: 'fund-id' } },
    ],
  })
})
