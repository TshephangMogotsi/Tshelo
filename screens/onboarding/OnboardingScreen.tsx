import { useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  Animated,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../context/ThemeContext'

const { width: W } = Dimensions.get('window')

const GRADIENT_START = '#7657F0'
const GRADIENT_END   = '#8874E1'
const PURPLE         = '#7657F0'
const BUTTON_BG      = '#EAE4FB'
const DOT_INACTIVE   = 8
const DOT_ACTIVE     = 28

type Slide = { id: string; title: string; body: string }

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Save together\nBuild together',
    body:  'Pool contributions for funerals, weddings, graduations and more, all in one transparent place',
  },
  {
    id: '2',
    title: 'Every thebe,\naccounted for',
    body:  'See who contributed what, in real time. No spreadsheets, no confusion, no chasing',
  },
  {
    id: '3',
    title: 'Safe, private\nand yours',
    body:  'Phone verification only, bank-level security. Your community data stays under your control',
  },
]

type Props = { onDone: () => void }

export default function OnboardingScreen({ onDone }: Props) {
  const { isDark } = useTheme()
  const cardBg      = isDark ? '#1A1C24' : '#FFFFFF'
  const headingColor = isDark ? '#FFFFFF' : '#0D0D0D'
  const bodyColor    = isDark ? 'rgba(255,255,255,0.65)' : '#52525B'

  const [index, setIndex] = useState(0)
  const flatRef  = useRef<FlatList<Slide>>(null)
  const scrollX  = useRef(new Animated.Value(0)).current
  const dotWidths = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? DOT_ACTIVE : DOT_INACTIVE))
  ).current

  const isLast = index === SLIDES.length - 1

  function animateDots(from: number, to: number) {
    Animated.parallel([
      Animated.spring(dotWidths[from], { toValue: DOT_INACTIVE, useNativeDriver: false, speed: 20, bounciness: 4 }),
      Animated.spring(dotWidths[to],   { toValue: DOT_ACTIVE,   useNativeDriver: false, speed: 20, bounciness: 4 }),
    ]).start()
  }

  function navigateTo(newIndex: number) {
    if (newIndex === index) return
    animateDots(index, newIndex)
    flatRef.current?.scrollToIndex({ index: newIndex, animated: true })
    setIndex(newIndex)
  }

  function goNext() {
    if (isLast) { onDone(); return }
    navigateTo(index + 1)
  }

  // Each slide's text is always rendered, driven directly by scrollX
  const slideAnims = SLIDES.map((_, i) => ({
    translateX: scrollX.interpolate({
      inputRange: [(i - 1) * W, i * W, (i + 1) * W],
      outputRange: [W * 0.6, 0, -W * 0.6],
      extrapolate: 'clamp',
    }),
    opacity: scrollX.interpolate({
      inputRange: [(i - 0.5) * W, i * W, (i + 0.5) * W],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    }),
  }))

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[GRADIENT_START, GRADIENT_END]}
        style={StyleSheet.absoluteFill}
      />

      {/* Invisible pager — drives scrollX in real time */}
      <Animated.FlatList
        ref={flatRef as any}
        data={SLIDES}
        keyExtractor={s => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={e => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / W)
          if (newIndex !== index) {
            animateDots(index, newIndex)
            setIndex(newIndex)
          }
        }}
        renderItem={() => <View style={{ width: W }} />}
        style={StyleSheet.absoluteFill}
        getItemLayout={(_, i) => ({ length: W, offset: W * i, index: i })}
      />

      {/* Bottom card */}
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        {/* All slide texts stacked — each fades/slides with scroll */}
        <View style={styles.textBlock}>
          {SLIDES.map((slide, i) => (
            <Animated.View
              key={slide.id}
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [{ translateX: slideAnims[i].translateX }],
                  opacity: slideAnims[i].opacity,
                },
              ]}
            >
              <Text style={[styles.heading, { color: headingColor }]}>{slide.title}</Text>
              <Text style={[styles.body, { color: bodyColor }]}>{slide.body}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => navigateTo(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Animated.View
                style={[styles.dot, {
                  width: dotWidths[i],
                  backgroundColor: i === index ? PURPLE : '#C4C4C4',
                }]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.button} onPress={goNext} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{isLast ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  card: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 100,
  },

  textBlock: {
    height: 160,
    marginBottom: 20,
  },
  heading: {
    fontSize: 32,
    fontFamily: fonts.display.bold,
    lineHeight: 40,
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_BG,
    borderRadius: 28,
    paddingVertical: 17,
  },
  buttonText: {
    color: PURPLE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
