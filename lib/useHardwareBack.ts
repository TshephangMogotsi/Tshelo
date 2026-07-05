import { useCallback, useRef } from 'react'
import { BackHandler } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

// Routes Android hardware/gesture back through a screen's own back logic,
// so multi-step flows step backward instead of losing progress to a screen
// pop. Handler returns true when it consumed the press, false to let React
// Navigation pop the screen as usual. No-op on iOS.
export function useHardwareBack(handler: () => boolean) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => handlerRef.current())
      return () => sub.remove()
    }, [])
  )
}
