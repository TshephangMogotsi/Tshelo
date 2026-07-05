import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { unregisterPushToken } from '../lib/pushNotifications'

type AuthContextType = {
  isAuthenticated: boolean
  profileCompleted: boolean
  userId: string | null
  userName: string
  tokenBalance: number
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

  async function checkProfile(uid: string) {
    setUserId(uid)
    const { data } = await supabase
      .from('users')
      .select('profile_completed, name, token_balance')
      .eq('id', uid)
      .single()
    setProfileCompleted(data?.profile_completed ?? false)
    setUserName(data?.name ?? '')
    setTokenBalance(data?.token_balance ?? 0)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsAuthenticated(!!session)
      if (session) await checkProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setIsAuthenticated(!!session)
      if (session) await checkProfile(session.user.id)
      else setProfileCompleted(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) await checkProfile(session.user.id)
  }

  async function signOut() {
    await unregisterPushToken()
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setProfileCompleted(false)
    setUserId(null)
    setUserName('')
    setTokenBalance(0)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, profileCompleted, userId, userName, tokenBalance, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
