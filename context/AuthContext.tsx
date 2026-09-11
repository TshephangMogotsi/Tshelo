import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { unregisterPushToken } from '../lib/pushNotifications'
import { findSignupCountry } from '../lib/countries'

export type SecuritySessionDetails = {
  phone: string
  phoneConfirmedAt: string | null
  lastSignInAt: string | null
}

type AuthContextType = {
  isAuthenticated: boolean
  profileCompleted: boolean
  userId: string | null
  userName: string
  countryCode: string | null
  preferredCurrency: string | null
  tokenBalance: number
  trustScore: number
  refreshProfile: () => Promise<void>
  loadSecuritySession: () => Promise<SecuritySessionDetails>
  signOutOtherSessions: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profileCompleted, setProfileCompleted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [preferredCurrency, setPreferredCurrency] = useState<string | null>(null)
  const [tokenBalance, setTokenBalance] = useState(0)
  const [trustScore, setTrustScore] = useState(0)

  const checkProfile = useCallback(async (uid: string) => {
    setUserId(uid)
    // Attach any Event + Fund organiser invitations that were sent to this
    // account's verified profile phone before the user next opened the app.
    try {
      const [, profile] = await Promise.all([
        api.events.syncOrganiserInvites().catch(() => undefined),
        api.users.me(),
      ])
      setProfileCompleted(profile.profile_completed)
      setUserName(profile.name ?? '')
      setCountryCode(profile.country_code ?? null)
      setPreferredCurrency(
        profile.preferred_currency
          ?? findSignupCountry(profile.country_code ?? '')?.currency
          ?? null
      )
      setTokenBalance(profile.token_balance ?? 0)
      setTrustScore(profile.trust_score ?? 0)
    } catch {
      // Keep the existing auth state; a foreground refresh can retry the API.
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsAuthenticated(!!session)
      if (session) await checkProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
      // Auth callbacks run while Supabase holds its auth lock. Do not await a
      // Supabase query here or the callback (and navigator update) can stall
      // until the app is restarted.
      if (session) void checkProfile(session.user.id)
      else {
        setProfileCompleted(false)
        setUserId(null)
        setUserName('')
        setCountryCode(null)
        setPreferredCurrency(null)
        setTokenBalance(0)
        setTrustScore(0)
      }
    })

    return () => subscription.unsubscribe()
  }, [checkProfile])

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await checkProfile(session.user.id)
  }, [checkProfile])

  const loadSecuritySession = useCallback(async (): Promise<SecuritySessionDetails> => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    if (!session) throw new Error('No active session.')

    return {
      phone: session.user.phone ?? '',
      phoneConfirmedAt: session.user.phone_confirmed_at ?? null,
      lastSignInAt: session.user.last_sign_in_at ?? null,
    }
  }, [])

  const signOutOtherSessions = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await unregisterPushToken()
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setProfileCompleted(false)
    setUserId(null)
    setUserName('')
    setCountryCode(null)
    setPreferredCurrency(null)
    setTokenBalance(0)
    setTrustScore(0)
  }, [])

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      profileCompleted,
      userId,
      userName,
      countryCode,
      preferredCurrency,
      tokenBalance,
      trustScore,
      refreshProfile,
      loadSecuritySession,
      signOutOtherSessions,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
