import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { AppState, Platform } from 'react-native'
import { requirePublicConfig } from './runtimeConfig'

const supabaseUrl = requirePublicConfig(
  'EXPO_PUBLIC_SUPABASE_URL',
  process.env.EXPO_PUBLIC_SUPABASE_URL,
)
const supabaseAnonKey = requirePublicConfig(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
)

// Supabase persists refresh tokens in this adapter. Native builds keep them in
// Keychain/Keystore; web retains AsyncStorage because SecureStore is native-only.
// getItem migrates an existing native AsyncStorage session on first launch so
// this hardening does not unexpectedly sign everyone out.
const authStorage = Platform.OS === 'web'
  ? AsyncStorage
  : {
      async getItem(key: string) {
        const secured = await SecureStore.getItemAsync(key)
        if (secured !== null) return secured

        const legacy = await AsyncStorage.getItem(key)
        if (legacy !== null) {
          await SecureStore.setItemAsync(key, legacy)
          await AsyncStorage.removeItem(key)
        }
        return legacy
      },
      setItem(key: string, value: string) {
        return SecureStore.setItemAsync(key, value)
      },
      removeItem(key: string) {
        return Promise.all([
          SecureStore.deleteItemAsync(key),
          AsyncStorage.removeItem(key),
        ]).then(() => undefined)
      },
    }

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,       // keeps user logged in
    persistSession: true,         // session survives app restart
    detectSessionInUrl: false,    // not a web app, turn this off
  },
})

// Token refresh only runs while the app is foregrounded; without this,
// sessions silently expire after the app sits in the background
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
