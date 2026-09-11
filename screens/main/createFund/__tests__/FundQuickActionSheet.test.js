jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }),
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const FundQuickActionSheet = require('../FundQuickActionSheet').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const fund = {
  id: 'fund-card',
  fundId: 'fund-id',
  kind: 'fund',
  title: 'Family Fund',
  status: 'active',
  currency_code: 'BWP',
}
const eventFund = {
  ...fund,
  id: 'event-fund-card',
  fundId: 'event-fund-id',
  eventId: 'event-id',
  kind: 'eventFund',
  title: 'Wedding Fund',
}

let tree
const onSelect = jest.fn()
const onClose = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    tree = create(React.createElement(FundQuickActionSheet, {
      action: 'expense',
      funds: [fund, eventFund],
      onSelect,
      onClose,
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('lists both Funds and Event + Funds for the selected action', () => {
  expect(tree.root.findByProps({ accessibilityLabel: 'Select Family Fund, Fund' })).toBeTruthy()
  expect(tree.root.findByProps({ accessibilityLabel: 'Select Wedding Fund, Event + Fund' })).toBeTruthy()
})

it('returns the selected fund to the financial action flow', () => {
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Select Wedding Fund, Event + Fund' }).props.onPress()
  })
  expect(onSelect).toHaveBeenCalledWith(eventFund)
})

it('can be dismissed without selecting a fund', () => {
  const closeButton = tree.root.findAll(node =>
    node.props.accessibilityLabel === 'Close fund selection'
    && typeof node.props.onPress === 'function'
  )[0]
  act(() => {
    closeButton.props.onPress()
  })
  expect(onClose).toHaveBeenCalledTimes(1)
})
