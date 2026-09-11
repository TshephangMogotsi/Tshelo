jest.mock('../../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../../theme/themes').lightColors, isDark: false }),
}))
jest.mock('@expo/vector-icons/Ionicons', () => 'Icon')
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))

const React = require('react')
const { act, create } = require('react-test-renderer')
const { StyleSheet, Text, TouchableOpacity } = require('react-native')
const { lightColors } = require('../../../../theme/themes')
const HomeItemCard = require('../HomeItemCard').default

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const baseItem = {
  id: 'fund-1',
  fundId: 'fund-1',
  kind: 'fund',
  title: 'Health Fund',
  status: 'active',
  goal_amount: 10000,
  budget_amount: 10000,
  budget_currency_code: 'BWP',
  total_contributions: 0,
  balance: 0,
  member_count: 1,
  guest_count: 0,
  role: 'owner',
  event_date: '',
  event_time: '',
  venue_name: '',
  category: 'Fund',
  emoji: '🩺',
  currency_code: 'BWP',
  created_at: '2026-09-11T08:00:00Z',
}

let tree

function renderCard(item = baseItem) {
  act(() => {
    tree = create(React.createElement(HomeItemCard, { item, onPress: jest.fn() }))
  })
}

afterEach(() => {
  if (tree) act(() => tree.unmount())
  tree = null
})

it('renders the saved fund icon instead of its legacy emoji', () => {
  renderCard()

  const iconNames = tree.root.findAllByType('Icon').map(node => node.props.name)
  const visibleText = tree.root.findAllByType(Text).map(node => node.props.children)

  expect(iconNames).toContain('medical-outline')
  expect(visibleText).not.toContain('🩺')
})

it('uses a neutral grey footer treatment for closed funds', () => {
  renderCard({ ...baseItem, status: 'closed' })

  const card = tree.root.findByType(TouchableOpacity)
  const progress = tree.root.findAllByType(Text).find(node => node.props.children === '0%')

  expect(StyleSheet.flatten(card.props.style)).toMatchObject({
    backgroundColor: lightColors.disabled,
    borderColor: lightColors.disabled,
  })
  expect(StyleSheet.flatten(progress.props.style)).toMatchObject({
    color: lightColors.disabledText,
  })
})

it('does not show an event-budget snapshot on event cards', () => {
  renderCard({
    ...baseItem,
    id: 'event-1',
    fundId: undefined,
    eventId: 'event-1',
    kind: 'event',
    title: 'Wedding',
    budget_amount: 25000,
    event_date: '2026-10-11',
    event_time: '14:30:00',
    venue_name: 'Cresta Lodge',
  })

  const visibleText = tree.root.findAllByType(Text).map(node => node.props.children)
  expect(visibleText).not.toContain('Event budget')
  expect(visibleText).not.toContain('P 25,000')
  expect(visibleText).toContain('11 Oct 2026')
  expect(visibleText).toContain('2:30 PM')
  expect(visibleText).toContain('Cresta Lodge')
})
