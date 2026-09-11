jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors }),
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')

const React = require('react')
const { act, create } = require('react-test-renderer')
const { Alert, Clipboard, Linking, Text } = require('react-native')
const VenueLocationField = require('../VenueLocationField').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let tree

function Harness({ initialVenue = 'Cresta Lodge, Gaborone', initialLink = '' }) {
  const [venue, setVenue] = React.useState(initialVenue)
  const [mapLink, setMapLink] = React.useState(initialLink)
  return React.createElement(VenueLocationField, {
    venue,
    onVenueChange: setVenue,
    mapLink,
    onMapLinkChange: setMapLink,
  })
}

function renderField(props = {}) {
  act(() => {
    tree = create(React.createElement(Harness, props))
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
  jest.restoreAllMocks()
})

it('keeps the optional exact-location input collapsed initially', () => {
  renderField()

  expect(tree.root.findByProps({ accessibilityLabel: 'Find venue in Maps' }).props.accessibilityState)
    .toEqual({ disabled: false })
  expect(tree.root.findAllByProps({ placeholder: 'Paste a Maps place link' })).toHaveLength(0)

  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Add exact map location' }).props.onPress()
  })

  expect(tree.root.findByProps({ placeholder: 'Paste a Maps place link' })).toBeDefined()
})

it('pastes a valid Maps link and offers a verification action', async () => {
  jest.spyOn(Clipboard, 'getString').mockResolvedValue('maps.app.goo.gl/abc123')
  renderField()

  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Add exact map location' }).props.onPress()
  })
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Paste map link from clipboard' }).props.onPress()
  })

  expect(tree.root.findByProps({ placeholder: 'Paste a Maps place link' }).props.value)
    .toBe('https://maps.app.goo.gl/abc123')
  expect(renderedText()).toContain('Location added')
  expect(tree.root.findByProps({ accessibilityLabel: 'Open exact map location to verify' })).toBeDefined()
})

it('rejects clipboard text that is not a supported Maps link', async () => {
  jest.spyOn(Clipboard, 'getString').mockResolvedValue('https://example.com/place')
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  renderField()

  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Add exact map location' }).props.onPress()
  })
  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Paste map link from clipboard' }).props.onPress()
  })

  expect(alert).toHaveBeenCalledWith(
    'Not a Maps link',
    'Copy a Google Maps, Apple Maps or Waze place link and try again.',
  )
  expect(renderedText()).not.toContain('Location added')
})

it('keeps an invalid exact-location state visible when its panel is collapsed', () => {
  renderField({ initialLink: 'https://example.com/place' })

  expect(tree.root.findByProps({ accessibilityLabel: 'Fix exact map location' })).toBeDefined()
  act(() => {
    tree.root.findByProps({ accessibilityLabel: 'Fix exact map location' }).props.onPress()
  })

  expect(tree.root.findAllByProps({ placeholder: 'Paste a Maps place link' })).toHaveLength(0)
  expect(tree.root.findByProps({ accessibilityLabel: 'Fix exact map location' })).toBeDefined()
})

it('opens the entered venue as a Maps search', async () => {
  const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  renderField()

  await act(async () => {
    tree.root.findByProps({ accessibilityLabel: 'Find venue in Maps' }).props.onPress()
  })

  expect(canOpen).toHaveBeenCalledWith(expect.stringContaining('Cresta%20Lodge%2C%20Gaborone'))
  expect(open).toHaveBeenCalledWith(expect.stringContaining('Cresta%20Lodge%2C%20Gaborone'))
})
