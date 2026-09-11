const mockBuildTokenPortalUrl = jest.fn()
const mockRefreshProfile = jest.fn()

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ tokenBalance: 12, refreshProfile: mockRefreshProfile }),
}))
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }))
jest.mock('../../../lib/tokenPortal', () => ({
  TOKEN_PORTAL_URL: 'https://checkout.example.com',
  buildTokenPortalUrl: (...args) => mockBuildTokenPortalUrl(...args),
}))

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Linking, TouchableOpacity } = require('react-native')
const TokenPurchaseScreen = require('../TokenPurchaseScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const navigation = { goBack: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  mockBuildTokenPortalUrl.mockReturnValue(null)
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
  jest.restoreAllMocks()
})

async function renderScreen() {
  await act(async () => {
    tree = create(React.createElement(TokenPurchaseScreen, {
      navigation,
      route: { name: 'Tokens' },
    }))
  })
}

it('shows a non-interactive checkout status when checkout is unavailable', async () => {
  await renderScreen()

  const status = tree.root.findByProps({
    accessibilityLabel: 'Secure checkout is being activated. No payment has been taken.',
  })
  expect(status.props.accessibilityLiveRegion).toBe('polite')
  expect(tree.root.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(0)
})

it('exposes the offers as selectable radio options with complete labels', async () => {
  await renderScreen()

  let offers = tree.root.findAllByType(TouchableOpacity).filter(
    item => item.props.accessibilityRole === 'radio',
  )
  expect(offers).toHaveLength(3)
  expect(offers[0].props.accessibilityState).toEqual({ checked: true })
  expect(offers[0].props.accessibilityLabel).toContain('Token top-up. 60 tokens. 50 Botswana pula')
  expect(offers[1].props.accessibilityLabel).toContain('Unlimited. 12-month pass. 300 Botswana pula')

  await act(async () => offers[1].props.onPress())
  offers = tree.root.findAllByType(TouchableOpacity).filter(
    item => item.props.accessibilityRole === 'radio',
  )
  expect(offers[0].props.accessibilityState).toEqual({ checked: false })
  expect(offers[1].props.accessibilityState).toEqual({ checked: true })
})

it('opens the configured secure checkout from an accessible button', async () => {
  mockBuildTokenPortalUrl.mockReturnValue('https://checkout.example.com?pack=top_up_60&source=app')
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  await renderScreen()

  const checkout = tree.root.findByProps({
    accessibilityLabel: 'Continue to secure checkout, P50.00',
  })
  expect(checkout.type).toBe(TouchableOpacity)
  await act(async () => checkout.props.onPress())
  expect(Linking.openURL).toHaveBeenCalledWith(
    'https://checkout.example.com?pack=top_up_60&source=app',
  )
})
