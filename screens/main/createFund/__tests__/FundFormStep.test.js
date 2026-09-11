jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')
jest.mock('../FlowHeader', () => 'FlowHeader')
jest.mock('../DateTimeSheet', () => 'DateTimeSheet')
jest.mock('../FundIconPickerSheet', () => 'FundIconPickerSheet')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text, TouchableOpacity } = require('react-native')
const { EMOJI_OPTIONS, OTHER_FUND_ICON_OPTIONS } = require('../constants')
const FundFormStep = require('../FundFormStep').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const onSelectEmoji = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    tree = create(React.createElement(FundFormStep, {
      name: '',
      onNameChange: jest.fn(),
      selectedEmoji: EMOJI_OPTIONS[0],
      onSelectEmoji,
      goalBWP: '',
      onGoalChange: jest.fn(),
      targetDate: null,
      onTargetDateChange: jest.fn(),
      isPrivate: false,
      onPrivateChange: jest.fn(),
      currencyCode: 'BWP',
      currencySymbol: 'P',
      isValid: false,
      isCreatingFund: false,
      onSubmit: jest.fn(),
      onBack: jest.fn(),
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

function renderedText() {
  const content = value => Array.isArray(value)
    ? value.map(content).join('')
    : value == null ? '' : String(value)
  return tree.root.findAllByType(Text).map(node => content(node.props.children)).join(' ')
}

it('uses an optional, accessible icon picker instead of rendering emoji choices', () => {
  expect(renderedText()).toContain('Fund icon')
  expect(renderedText()).toContain('(optional)')

  const choices = tree.root.findAllByType(TouchableOpacity)
    .filter(node => node.props.accessibilityRole === 'radio')
  expect(choices).toHaveLength(5)
  expect(tree.root.findByProps({ accessibilityLabel: 'General fund icon' }).props.accessibilityState)
    .toEqual({ checked: true })
})

it('opens more choices instead of treating Other as a generic selection', () => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'More fund icons' }).props.onPress()
  })

  expect(onSelectEmoji).not.toHaveBeenCalled()
  expect(tree.root.findByType('FundIconPickerSheet').props.visible).toBe(true)
})

it('applies a chosen additional icon and closes the picker', () => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'More fund icons' }).props.onPress()
  })
  act(() => {
    tree.root.findByType('FundIconPickerSheet').props.onSelect(OTHER_FUND_ICON_OPTIONS[0])
  })

  expect(onSelectEmoji).toHaveBeenCalledWith(expect.objectContaining({
    id: 'health',
    icon: 'medical-outline',
    emoji: '🩺',
  }))
  expect(tree.root.findByType('FundIconPickerSheet').props.visible).toBe(false)
})
