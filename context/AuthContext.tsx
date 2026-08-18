import { createContext, useCallback, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { unregisterPushToken } from '../lib/pushNotifications'

type AuthContextType = {
  isAuthenticated: boolean
  profileCompleted: boolean
  userId: string | null
  userName: string
  tokenBalance: number
  trustScore: number
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profileCompleted, setProfileCompleted] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
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

  const signOut = useCallback(async () => {
    await unregisterPushToken()
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setProfileCompleted(false)
    setUserId(null)
    setUserName('')
    setTokenBalance(0)
    setTrustScore(0)
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, profileCompleted, userId, userName, tokenBalance, trustScore, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
