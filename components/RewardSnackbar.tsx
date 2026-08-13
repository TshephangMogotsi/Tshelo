import { useEffect, useRef } from 'react'
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../context/ThemeContext'
import { fonts } from '../theme/typography'
import type { AppColors } from '../theme/themes'

export type RewardSnackbarItem = {
  id: string
  name: string
  description: string
  points: number
  iconName: string
}

type Props = {
  reward: RewardSnackbarItem | null
  onDismiss: () => void
  onOpen: () => void
}

const DISPLAY_MS = 4200

export default function RewardSnackbar({ reward, onDismiss, onOpen }: Props) {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const styles = makeStyles(colors)
  const translateY = useRef(new Animated.Value(-130)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.96)).current

  useEffect(() => {
    if (!reward) return

    translateY.setValue(-130)
    opacity.setValue(0)
    scale.setValue(0.96)

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        speed: 17,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 18,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start()

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -110,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onDismiss()
      })
    }, DISPLAY_MS)

    return () => clearTimeout(timer)
  }, [opacity, onDismiss, reward, scale, translateY])

  if (!reward) return null

  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[
        styles.position,
        { top: insets.top + 10, opacity, transform: [{ translateY }, { scale }] },
      ]}
    >
      <Pressable
        style={styles.card}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${reward.name} achievement unlocked. ${reward.points} trust points earned.`}
      >
        <View style={styles.iconWrap}>
          <Ionicons
            name={(reward.iconName || 'trophy-outline') as keyof typeof Ionicons.glyphMap}
            size={23}
            color={colors.primary}
          />
          <View style={styles.sparkle}>
            <Ionicons name="sparkles" size={10} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.title} numberOfLines={1}>{reward.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {reward.points > 0 ? `+${reward.points} trust points` : reward.description}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.close}
          onPress={event => {
            event.stopPropagation()
            onDismiss()
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss reward"
        >
          <Ionicons name="close" size={17} color={colors.textSecondary} />
        </TouchableOpacity>
      </Pressable>
    </Animated.View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    position: {
      position: 'absolute',
      left: 14,
      right: 14,
      zIndex: 9999,
      elevation: 30,
    },
    card: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingLeft: 12,
      paddingRight: 8,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: '#E8DDFF',
      shadowColor: '#4B168E',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
    },
    iconWrap: {
      width: 50,
      height: 50,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E8DDFF',
    },
    sparkle: {
      position: 'absolute',
      right: -3,
      top: -3,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    copy: { flex: 1, minWidth: 0 },
    eyebrow: {
      fontFamily: fonts.inter.bold,
      fontSize: 9,
      letterSpacing: 0.8,
      color: colors.primary,
      marginBottom: 2,
    },
    title: {
      fontFamily: fonts.inter.extraBold,
      fontSize: 15,
      color: colors.textPrimary,
    },
    subtitle: {
      fontFamily: fonts.inter.medium,
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    close: {
      width: 34,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
}
