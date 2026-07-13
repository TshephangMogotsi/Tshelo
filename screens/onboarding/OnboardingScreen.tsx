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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts } from '../../theme/typography'
import { useTheme } from '../../context/ThemeContext'

const { width: W } = Dimensions.get('window')

const GRADIENT_START = '#7657F0'
const GRADIENT_END   = '#8874E1'
const PURPLE         = '#7657F0'
const BUTTON_BG      = '#EAE4FB'
const DOT_INACTIVE   = 8
const DOT_ACTIVE     = 28

type Slide = {
  id:     string
  title:  string
  body:   string
  image?: ReturnType<typeof require>
}

const SLIDES: Slide[] = [
  {
    id:    '1',
    title: 'Community contributions,\nmade transparent',
    body:  'Track motshelo, stokvels, and family funds with complete visibility for everyone.',
    image: require('../../assets/image-1.png'),
  },
  {
    id:    '2',
    title: 'Track every\ncontribution',
    body:  'See who contributed, how much, and when. No more spreadsheets or confusion.',
    image: require('../../assets/image-2.png'),
  },
  {
    id:    '3',
    title: 'Full audit trail',
    body:  'Every action is recorded. Everyone can see the complete history. No secrets.',
    image: require('../../assets/image-3-new.png'),
  },
  {
    id:    '4',
    title: 'We never touch\nyour money',
    body:  'Tshelo is a tracking layer only. Payments happen your way — cash, mobile money, or bank transfer.',
    image: require('../../assets/image-4.png'),
  },
]

type Props = { onDone: (dest?: 'CountrySelect' | 'Login') => void }

export default function OnboardingScreen({ onDone }: Props) {
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const cardBg      = isDark ? '#1A1C24' : '#FFFFFF'
  const headingColor = isDark ? '#FFFFFF' : '#0D0D0D'
  const bodyColor    = isDark ? 'rgba(255,255,255,0.65)' : '#52525B'

  const [index, setIndex] = useState(0)
  const flatRef   = useRef<FlatList<Slide>>(null)
  const scrollX   = useRef(new Animated.Value(0)).current
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

  const slideAnims = SLIDES.map((_, i) => {
    const imageOffset = i === 2 ? -40 : 0
    return {
    translateX: scrollX.interpolate({
      inputRange: [(i - 1) * W, i * W, (i + 1) * W],
      outputRange: [W * 0.6, 0, -W * 0.6],
      extrapolate: 'clamp',
    }),
    imageTranslateX: scrollX.interpolate({
      inputRange: [(i - 1) * W, i * W, (i + 1) * W],
      outputRange: [W * 0.6 + imageOffset, imageOffset, -W * 0.6 + imageOffset],
      extrapolate: 'clamp',
    }),
    opacity: scrollX.interpolate({
      inputRange: [(i - 0.5) * W, i * W, (i + 0.5) * W],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    }),
  }
  })

  const buttonLabel = isLast ? 'Get Started' : 'Next'

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Purple gradient — base background for slides 1-3 */}
      <LinearGradient
        colors={[GRADIENT_START, GRADIENT_END]}
        style={StyleSheet.absoluteFill}
      />

      {/* Invisible pager — drives scrollX */}
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

      {/* Illustration area */}
      <View style={styles.illustrationArea} pointerEvents="none">
        {/* All 4 slides parallax images */}
        {SLIDES.map((slide, i) => (
          <Animated.Image
            key={slide.id}
            source={slide.image!}
            style={[
              styles.illustration,
              i === 2 && { width: W * 0.8625, height: (W * 1.1 - 20) * 0.8625 },
              i === 3 && { width: W * 0.6624, height: (W * 1.1 - 20) * 0.6624 },
              {
                top: insets.top + 12 + (i === 3 ? 80 : 0),
                transform: [
                  { translateX: slideAnims[i].imageTranslateX },
                ],
                opacity: slideAnims[i].opacity,
              },
            ]}
            resizeMode="contain"
          />
        ))}

      </View>

      {/* Card */}
      <View style={[styles.cardWrap, { backgroundColor: cardBg }]}>
        <View style={[styles.card, { paddingBottom: insets.bottom + 20 }]}>

          {/* Slide text — all 4 slides use the same animation */}
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
            <Text style={styles.buttonText}>{buttonLabel}</Text>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  illustrationArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    position: 'absolute',
    width: W,
    height: W * 1.1 - 20,
  },

  cardWrap: {
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
  },
  card: {
    paddingHorizontal: 28,
    paddingTop: 32,
  },

  textBlock: {
    height: 175,
    marginBottom: 16,
  },
  heading: {
    fontSize: 30,
    fontFamily: fonts.display.bold,
    lineHeight: 38,
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
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
    marginBottom: 12,
  },
  buttonText: {
    color: PURPLE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

})
