jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { StyleSheet, Text, TouchableOpacity } = require('react-native')
const EventCreatedScreen = require('../EventCreatedScreen').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree
const onShare = jest.fn()
const onViewEvent = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  act(() => {
    tree = create(React.createElement(EventCreatedScreen, {
      eventName: 'Family Celebration',
      eventDate: new Date(2026, 9, 11),
      eventVenue: 'Cresta Lodge, Gaborone',
      onShare,
      onViewEvent,
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

it('uses the clean success hierarchy without decorative emoji or confetti', () => {
  const iconNames = tree.root.findAllByType('Icon').map(node => node.props.name)

  expect(renderedText()).toContain('Event Created!')
  expect(renderedText()).toContain('Family Celebration is ready for guests')
  expect(renderedText()).toContain('Cresta Lodge, Gaborone')
  expect(renderedText()).not.toMatch(/[🎉🎊✨💜]/u)
  expect(renderedText()).not.toContain('Done')
  expect(iconNames).toContain('checkmark-circle')
})

it('keeps sharing secondary and makes View Event the full-width primary action', () => {
  const shareButton = tree.root.findAllByType(TouchableOpacity).find(node => (
    node.props.accessibilityLabel === 'Share RSVP link'
  ))
  const viewButton = tree.root.findAllByType(TouchableOpacity).find(node => (
    node.props.accessibilityLabel === 'View Event'
  ))

  expect(StyleSheet.flatten(shareButton.props.style)).toMatchObject({
    width: '100%',
    backgroundColor: '#FFFFFF',
  })
  expect(StyleSheet.flatten(viewButton.props.style)).toMatchObject({
    width: '100%',
    backgroundColor: '#7B2FFF',
  })

  act(() => shareButton.props.onPress())
  act(() => viewButton.props.onPress())
  expect(onShare).toHaveBeenCalledTimes(1)
  expect(onViewEvent).toHaveBeenCalledTimes(1)
})
