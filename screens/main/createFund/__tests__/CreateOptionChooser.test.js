jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const CreateOptionChooser = require('../CreateOptionChooser').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const onQuickAction = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    tree = create(React.createElement(CreateOptionChooser, {
      onSelect: jest.fn(),
      onQuickAction,
      onBack: jest.fn(),
      visibleQuickActions: new Set(['joinFund', 'joinEvent', 'contribution', 'expense']),
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('shows Record Expense as an accessible quick action', () => {
  const action = tree.root.findByProps({ accessibilityLabel: 'Record Expense' })

  expect(action.props.accessibilityRole).toBe('button')
  act(() => action.props.onPress())
  expect(onQuickAction).toHaveBeenCalledWith('expense')
})
