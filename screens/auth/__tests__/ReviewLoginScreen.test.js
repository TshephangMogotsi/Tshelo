jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false }),
}))
jest.mock('../../../context/ConnectivityContext', () => ({ useRequireOnline: () => () => true }))
jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ refreshProfile: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: jest.fn(), signOut: jest.fn() } },
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert, TextInput, TouchableOpacity } = require('react-native')
const ReviewLoginScreen = require('../ReviewLoginScreen').default
const { supabase } = require('../../../lib/supabase')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const navigation = { goBack: jest.fn() }

function button(label) {
  return tree.root.findAllByType(TouchableOpacity).find(item => item.props.accessibilityLabel === label)
}

beforeEach(() => {
  jest.clearAllMocks()
  supabase.auth.signOut.mockResolvedValue({ error: null })
})

afterEach(async () => {
  if (tree) await act(async () => tree.unmount())
  tree = null
})

it('allows only an account marked by Supabase as a Google Play reviewer', async () => {
  await act(async () => { tree = create(React.createElement(ReviewLoginScreen, { navigation })) })
  const inputs = tree.root.findAllByType(TextInput)
  await act(async () => inputs[0].props.onChangeText('play-review@tshelo.example'))
  await act(async () => inputs[1].props.onChangeText('a-long-review-password'))
  supabase.auth.signInWithPassword.mockResolvedValue({
    data: { user: { app_metadata: { google_play_reviewer: true } } },
    error: null,
  })

  await act(async () => button('Sign in with review credentials').props.onPress())

  expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'play-review@tshelo.example',
    password: 'a-long-review-password',
  })
  expect(supabase.auth.signOut).not.toHaveBeenCalled()
})

it('signs out an unmarked account instead of granting review access', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  await act(async () => { tree = create(React.createElement(ReviewLoginScreen, { navigation })) })
  const inputs = tree.root.findAllByType(TextInput)
  await act(async () => inputs[0].props.onChangeText('ordinary@example.com'))
  await act(async () => inputs[1].props.onChangeText('not-a-reviewer-password'))
  supabase.auth.signInWithPassword.mockResolvedValue({
    data: { user: { app_metadata: {} } },
    error: null,
  })

  await act(async () => button('Sign in with review credentials').props.onPress())

  expect(supabase.auth.signOut).toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith('Review access unavailable', expect.any(String))
})
