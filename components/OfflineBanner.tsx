import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConnectivity } from '../context/ConnectivityContext'
import { useTheme } from '../context/ThemeContext'

const BACK_ONLINE_DURATION = 2000

export default function OfflineBanner() {
  const { isOnline } = useConnectivity()
  const { isDark } = useTheme()
  const insets = useSafeAreaInsets()

  const [visible, setVisible] = useState(false)
  const [backOnline, setBackOnline] = useState(false)
  const opacity = useRef(new Animated.Value(0)).current
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true
      setBackOnline(false)
      setVisible(true)
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
      return
    }

    if (!wasOffline.current) return

    // Reconnected: flash "Back online" briefly, then fade out
    wasOffline.current = false
    setBackOnline(true)
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setVisible(false)
        setBackOnline(false)
      })
    }, BACK_ONLINE_DURATION)
    return () => clearTimeout(timer)
  }, [isOnline])

  if (!visible) return null

  const backgroundColor = backOnline ? '#2E7D32' : isDark ? '#2D2E41' : '#3A3A3F'

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.banner, { paddingTop: insets.top + 6, backgroundColor, opacity }]}
    >
      <Text style={styles.text}>
        {backOnline ? 'Back online' : 'No internet connection'}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 100,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
})
