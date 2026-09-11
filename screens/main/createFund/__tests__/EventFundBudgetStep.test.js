jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')
jest.mock('../FlowHeader', () => 'FlowHeader')

const React = require('react')
const { act, create } = require('react-test-renderer')
const EventFundBudgetStep = require('../EventFundBudgetStep').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const onFundGoalPercentChange = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    tree = create(React.createElement(EventFundBudgetStep, {
      eventBudget: '50,000',
      onEventBudgetChange: jest.fn(),
      fundGoalPercent: 65,
      onFundGoalPercentChange,
      eventName: 'Test event',
      currencySymbol: 'P',
      isCreating: false,
      onCreate: jest.fn(),
      onBack: jest.fn(),
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('previews slider movement locally and commits once when the drag ends', () => {
  let slider = tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' })
  act(() => slider.props.onLayout({ nativeEvent: { layout: { width: 200 } } }))

  slider = tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' })
  act(() => slider.props.onResponderGrant({ nativeEvent: { locationX: 70 } }))
  expect(onFundGoalPercentChange).not.toHaveBeenCalled()
  expect(tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' }).props.accessibilityValue.now).toBe(35)

  slider = tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' })
  act(() => slider.props.onResponderMove({ nativeEvent: { locationX: 82 } }))
  expect(onFundGoalPercentChange).not.toHaveBeenCalled()
  expect(tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' }).props.accessibilityValue.now).toBe(41)

  slider = tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' })
  act(() => slider.props.onResponderRelease())
  expect(onFundGoalPercentChange).toHaveBeenCalledTimes(1)
  expect(onFundGoalPercentChange).toHaveBeenCalledWith(41)
})

it('does not allow the parent ScrollView to steal an active slider gesture', () => {
  const slider = tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' })
  expect(slider.props.onResponderTerminationRequest()).toBe(false)
})

it('adjusts the percentage by one point for accessibility actions', () => {
  const slider = tree.root.findByProps({ accessibilityLabel: 'Fund goal percentage' })

  act(() => slider.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }))

  expect(onFundGoalPercentChange).toHaveBeenCalledWith(66)
})
