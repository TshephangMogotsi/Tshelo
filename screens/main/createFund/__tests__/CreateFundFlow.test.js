jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }))
jest.mock('expo-contacts', () => ({}))
jest.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    userId: 'user-1',
    tokenBalance: 10,
    preferredCurrency: 'ZMW',
    refreshProfile: jest.fn().mockResolvedValue(undefined),
  }),
}))
jest.mock('../../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../../lib/useHardwareBack', () => ({ useHardwareBack: jest.fn() }))
jest.mock('../../../../lib/haptics', () => ({ hapticSuccess: jest.fn(), hapticError: jest.fn() }))
jest.mock('../../../../lib/api', () => ({ api: {} }))
jest.mock('../../../../lib/useFundPermissions', () => ({
  useFundPermissions: () => ({ can: () => false }),
}))
jest.mock('../../home/loadHomeItems', () => ({
  loadHomeItems: jest.fn().mockResolvedValue([]),
}))
jest.mock('../CreateOptionChooser', () => 'CreateOptionChooser')
jest.mock('../CurrencyStep', () => 'CurrencyStep')
jest.mock('../FundFormStep', () => 'FundFormStep')
jest.mock('../EventTypeStep', () => 'EventTypeStep')
jest.mock('../EventDetailsStep', () => 'EventDetailsStep')
jest.mock('../EventOrganisersStep', () => 'EventOrganisersStep')
jest.mock('../EventCreatedScreen', () => 'EventCreatedScreen')
jest.mock('../EventFundTypeStep', () => 'EventFundTypeStep')
jest.mock('../EventFundDetailsStep', () => 'EventFundDetailsStep')
jest.mock('../EventFundOrganisersStep', () => 'EventFundOrganisersStep')
jest.mock('../EventFundBudgetStep', () => 'EventFundBudgetStep')
jest.mock('../FundQuickActionSheet', () => 'FundQuickActionSheet')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { OTHER_FUND_ICON_OPTIONS } = require('../constants')
const CreateFundScreen = require('../../CreateFundScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree

beforeEach(() => {
  act(() => {
    tree = create(React.createElement(CreateFundScreen, {
      navigation: {
        navigate: jest.fn(),
        goBack: jest.fn(),
        popToTop: jest.fn(),
        replace: jest.fn(),
      },
    }))
  })
})

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('starts Event and Fund with the shared home-currency step before event type', () => {
  act(() => tree.root.findByType('CreateOptionChooser').props.onSelect('eventFund'))

  const currencyStep = tree.root.findByType('CurrencyStep')
  expect(currencyStep.props).toMatchObject({
    currency: 'ZMW',
    homeCurrency: 'ZMW',
    flowTitle: 'Event + Fund',
    stepLabel: 'Step 1 of 5',
  })

  act(() => currencyStep.props.onContinue())
  const typeStep = tree.root.findByType('EventFundTypeStep')
  expect(typeStep.props.selectedFundIcon.id).toBe('general')

  act(() => typeStep.props.onSelectFundIcon(OTHER_FUND_ICON_OPTIONS[0]))
  expect(tree.root.findByType('EventFundTypeStep').props.selectedFundIcon.id).toBe('health')

  act(() => tree.root.findByType('EventFundTypeStep').props.onBack())
  expect(tree.root.findByType('CurrencyStep')).toBeDefined()
})
