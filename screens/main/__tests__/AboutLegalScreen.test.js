jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))
const mockOpenLegalDocument = jest.fn()
jest.mock('../../../lib/legalDocuments', () => ({
  openLegalDocument: mockOpenLegalDocument,
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text } = require('react-native')
const appConfig = require('../../../app.json')
const AboutLegalScreen = require('../AboutLegalScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const navigation = { goBack: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  mockOpenLegalDocument.mockResolvedValue(true)
  act(() => {
    tree = create(React.createElement(AboutLegalScreen, { navigation }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

function hasText(label) {
  const content = value => Array.isArray(value)
    ? value.map(content).join('')
    : value == null ? '' : String(value)
  return tree.root.findAllByType(Text).some(text => content(text.props.children) === label)
}

it('shows Tshelo information and the configured app version', () => {
  expect(hasText('Tshelo')).toBe(true)
  expect(hasText('Plan together. Contribute transparently.')).toBe(true)
  expect(hasText(`Version ${appConfig.expo.version}`)).toBe(true)
})

it.each([
  ['Open Terms of Service', 'terms'],
  ['Open Privacy Policy', 'privacy'],
])('opens %s through the shared legal-document handler', (accessibilityLabel, document) => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel }).props.onPress()
  })
  expect(mockOpenLegalDocument).toHaveBeenCalledWith(document)
})

it('returns to Profile from the header', () => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Go back' }).props.onPress()
  })
  expect(navigation.goBack).toHaveBeenCalledTimes(1)
})
