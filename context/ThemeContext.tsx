import { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lightColors, darkColors, AppColors } from '../theme/themes'

export type ThemePreference = 'light' | 'dark' | 'system'

type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  isDark: boolean
  colors: AppColors
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  setPreference: () => {},
  isDark: false,
  colors: lightColors,
})

const THEME_KEY = 'tshelo_theme_v1'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setPreferenceState(val)
      }
    })
  }, [])

  async function setPreference(p: ThemePreference) {
    setPreferenceState(p)
    await AsyncStorage.setItem(THEME_KEY, p)
  }

  const isDark =
    preference === 'dark' ||
    (preference === 'system' && systemScheme === 'dark')

  const colors = isDark ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ preference, setPreference, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
