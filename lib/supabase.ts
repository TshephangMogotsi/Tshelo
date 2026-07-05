import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export function fundPreviewUrl(fundCode: string): string {
  return `${supabaseUrl}/functions/v1/fund-preview?code=${encodeURIComponent(fundCode)}`
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,        // stores session on device
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