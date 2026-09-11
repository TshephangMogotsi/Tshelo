jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')
jest.mock('../FlowHeader', () => 'FlowHeader')
jest.mock('../FundIconPickerSheet', () => 'FundIconPickerSheet')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Text, TouchableOpacity } = require('react-native')
const { EMOJI_OPTIONS, EVENT_TYPES, OTHER_FUND_ICON_OPTIONS } = require('../constants')
const EventFundTypeStep = require('../EventFundTypeStep').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree

function renderStep(overrides = {}) {
  act(() => {
    tree = create(React.createElement(EventFundTypeStep, {
      eventType: EVENT_TYPES[0],
      onSelectType: jest.fn(),
      isOtherEvent: false,
      customEventType: '',
      onCustomEventTypeChange: jest.fn(),
      selectedFundIcon: EMOJI_OPTIONS[0],
      onSelectFundIcon: jest.fn(),
      isStepValid: true,
      onContinue: jest.fn(),
      onBack: jest.fn(),
      ...overrides,
    }))
  })
}

function renderedText() {
  const content = value => Array.isArray(value)
    ? value.map(content).join('')
    : value == null ? '' : String(value)
  return tree.root.findAllByType(Text).map(node => content(node.props.children)).join(' ')
}

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('uses accessible icons instead of emoji choices', () => {
  renderStep()

  const choices = tree.root.findAllByType(TouchableOpacity)
    .filter(node => node.props.accessibilityRole === 'radio')
  const iconNames = tree.root.findAllByType('Icon').map(node => node.props.name)

  expect(choices).toHaveLength(5)
  expect(tree.root.findByProps({ accessibilityLabel: 'Wedding event type' }).props.accessibilityState)
    .toEqual({ checked: true })
  expect(iconNames).toEqual(expect.arrayContaining([
    'heart-outline',
    'flame-outline',
    'school-outline',
    'gift-outline',
    'shapes-outline',
  ]))
  expect(renderedText()).not.toMatch(/[🏠🕯️🎓🎂🎉]/u)
  expect(tree.root.findByType('FlowHeader').props.step).toBe('Step 2 of 5')
})

it('puts the fund icon picker inside the custom event type field', () => {
  const other = EVENT_TYPES.find(item => item.id === 'other')
  renderStep({ eventType: other, isOtherEvent: true })

  expect(renderedText()).toContain('Custom event type')
  expect(renderedText()).not.toContain('Fund icon')
  expect(renderedText()).not.toContain('Choose an emoji')
  expect(tree.root.findByProps({ placeholder: 'Name your event type' })).toBeDefined()
  const iconButton = tree.root.findByProps({ accessibilityLabel: 'Choose fund icon. Current selection General' })
  expect(iconButton.props.accessibilityHint).toBe('Opens the fund icon picker')
})

it('saves a chosen fund icon and closes the picker', () => {
  const other = EVENT_TYPES.find(item => item.id === 'other')
  const onSelectFundIcon = jest.fn()
  renderStep({ eventType: other, isOtherEvent: true, onSelectFundIcon })

  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Choose fund icon. Current selection General' }).props.onPress()
  })
  expect(tree.root.findByType('FundIconPickerSheet').props.visible).toBe(true)

  act(() => {
    tree.root.findByType('FundIconPickerSheet').props.onSelect(OTHER_FUND_ICON_OPTIONS[0])
  })
  expect(onSelectFundIcon).toHaveBeenCalledWith(expect.objectContaining({
    id: 'health',
    icon: 'medical-outline',
  }))
  expect(tree.root.findByType('FundIconPickerSheet').props.visible).toBe(false)
})
