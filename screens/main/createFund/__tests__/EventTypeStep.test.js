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
const EventTypeStep = require('../EventTypeStep').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree

function renderStep(overrides = {}) {
  act(() => {
    tree = create(React.createElement(EventTypeStep, {
      eventType: EVENT_TYPES[0],
      onSelectType: jest.fn(),
      isOtherEvent: false,
      customEventType: '',
      onCustomEventTypeChange: jest.fn(),
      selectedEventIcon: EMOJI_OPTIONS[0],
      onSelectEventIcon: jest.fn(),
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

it('uses the shared accessible event icons instead of emoji cards', () => {
  renderStep()

  const choices = tree.root.findAllByType(TouchableOpacity)
    .filter(node => node.props.accessibilityRole === 'radio')
  const iconNames = tree.root.findAllByType('Icon').map(node => node.props.name)

  expect(choices).toHaveLength(6)
  expect(tree.root.findByProps({ accessibilityLabel: 'Wedding event type' }).props.accessibilityState)
    .toEqual({ checked: true })
  expect(iconNames).toEqual(expect.arrayContaining([
    'heart-outline',
    'flame-outline',
    'school-outline',
    'gift-outline',
    'happy-outline',
    'shapes-outline',
  ]))
  expect(renderedText()).not.toMatch(/[🏠🕯️🎓🎂👶🎉]/u)
})

it('keeps Other focused on naming the custom event type', () => {
  const other = EVENT_TYPES.find(item => item.id === 'other')
  renderStep({ eventType: other, isOtherEvent: true })

  expect(renderedText()).toContain('Custom event type')
  expect(renderedText()).not.toContain('Choose an emoji')
  expect(tree.root.findByProps({ placeholder: 'Name your event type' })).toBeDefined()
  expect(tree.root.findByProps({ accessibilityLabel: 'Choose event icon. Current selection General' })).toBeDefined()
})

it('opens the shared picker and applies a custom event icon', () => {
  const other = EVENT_TYPES.find(item => item.id === 'other')
  const onSelectEventIcon = jest.fn()
  renderStep({ eventType: other, isOtherEvent: true, onSelectEventIcon })

  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Choose event icon. Current selection General' }).props.onPress()
  })
  const picker = tree.root.findByType('FundIconPickerSheet')
  expect(picker.props).toMatchObject({
    visible: true,
    selectedId: 'general',
    title: 'Choose an event icon',
    accessibilityNoun: 'event',
  })

  act(() => picker.props.onSelect(OTHER_FUND_ICON_OPTIONS[0]))
  expect(onSelectEventIcon).toHaveBeenCalledWith(expect.objectContaining({
    id: 'health',
    icon: 'medical-outline',
  }))
  expect(tree.root.findByType('FundIconPickerSheet').props.visible).toBe(false)
})
