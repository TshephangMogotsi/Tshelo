jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { TouchableOpacity } = require('react-native')
const FundIconPickerSheet = require('../FundIconPickerSheet').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const onSelect = jest.fn()
const onClose = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    tree = create(React.createElement(FundIconPickerSheet, {
      visible: true,
      selectedId: 'health',
      onSelect,
      onClose,
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('shows a curated accessible set of additional fund icons', () => {
  const choices = tree.root.findAllByType(TouchableOpacity)
    .filter(node => node.props.accessibilityRole === 'radio')

  expect(choices).toHaveLength(12)
  expect(tree.root.findByProps({ accessibilityLabel: 'Health fund icon' }).props.accessibilityState)
    .toEqual({ checked: true })
  expect(tree.root.findByProps({ accessibilityLabel: 'Emergency fund icon' })).toBeTruthy()
})

it('returns the selected additional icon', () => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Travel fund icon' }).props.onPress()
  })
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    id: 'travel',
    icon: 'airplane-outline',
  }))
})

it('can be dismissed without changing the selection', () => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Close fund icon picker' }).props.onPress()
  })
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onSelect).not.toHaveBeenCalled()
})
