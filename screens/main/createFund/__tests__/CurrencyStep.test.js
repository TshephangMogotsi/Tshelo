jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text } = require('react-native')
const CurrencyStep = require('../CurrencyStep').default
const { resolveFundCurrency } = require('../constants')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree

function textContent(value) {
  return Array.isArray(value)
    ? value.map(textContent).join('')
    : value == null ? '' : String(value)
}

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('shows and selects the member home currency first', () => {
  act(() => {
    tree = create(React.createElement(CurrencyStep, {
      currency: 'ZMW',
      homeCurrency: 'ZMW',
      onSelectCurrency: jest.fn(),
      onContinue: jest.fn(),
      onBack: jest.fn(),
    }))
  })

  const text = tree.root.findAllByType(Text).map(node => textContent(node.props.children))
  const currencyCodes = text.filter(value => ['ZMW', 'BWP', 'ZAR', 'USD'].includes(value))

  expect(currencyCodes.slice(0, 4)).toEqual(['ZMW', 'BWP', 'ZAR', 'USD'])
  expect(text).toContain('HOME')
  expect(text).toContain('ZMW · Zambian kwacha')
})

it('falls back safely when the profile has no valid currency', () => {
  expect(resolveFundCurrency(null)).toBe('BWP')
  expect(resolveFundCurrency('zmw')).toBe('ZMW')
  expect(resolveFundCurrency('invalid')).toBe('BWP')
  expect(resolveFundCurrency('XXX')).toBe('BWP')
})
