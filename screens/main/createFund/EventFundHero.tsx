import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BACK_HIT_SLOP, BRAND_ACCENT, BRAND_PURPLE } from './constants'

type Props = {
  stepsDone: 1 | 2 | 3 | 4
  large?: boolean
  onBack: () => void
}

const SEGMENTS = [1, 2, 3, 4] as const

export default function EventFundHero({ stepsDone, large, onBack }: Props) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <TouchableOpacity style={styles.back} onPress={onBack} hitSlop={BACK_HIT_SLOP}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {large ? (
          <>
            <View style={styles.pill}>
              <Text style={styles.sparkle}>✨</Text>
              <Text style={styles.pillText}>Event +{'\n'}Fund</Text>
            </View>

            <View style={styles.cost}>
              <Text style={styles.costText}>15</Text>
              <View style={styles.coin}>
                <Ionicons name="server" size={12} color="#FFFFFF" />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.pillCompact}>
              <Text style={styles.pillTextSingle}>Event + Fund</Text>
            </View>

            <View style={styles.costInline}>
              <Text style={styles.costText}>15</Text>
              <View style={styles.coin}>
                <Ionicons name="server" size={12} color="#FFFFFF" />
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.progress}>
        {SEGMENTS.map(segment => (
          <View
            key={segment}
            style={[styles.progressSegment, segment <= stepsDone && styles.progressActive]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: BRAND_PURPLE,
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 26,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 26,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    minWidth: 188,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 36,
    paddingHorizontal: 24,
  },
  sparkle: {
    fontSize: 22,
  },
  pillText: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  pillCompact: {
    minWidth: 172,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 32,
    paddingHorizontal: 22,
  },
  pillTextSingle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  cost: {
    width: 46,
    alignItems: 'center',
  },
  costInline: {
    width: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  costText: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  coin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_ACCENT,
  },
  progress: {
    flexDirection: 'row',
    gap: 12,
  },
  progressSegment: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  progressActive: {
    backgroundColor: '#55CFC6',
  },
})
