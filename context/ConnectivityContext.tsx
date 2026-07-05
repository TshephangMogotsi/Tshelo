import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

type ConnectivityContextValue = {
  isOnline: boolean
}

const ConnectivityContext = createContext<ConnectivityContextValue>({ isOnline: true })

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // isInternetReachable is null while undetermined — only treat a
      // definitive false as offline so we don't flash the banner on launch
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false)
    })
    return unsubscribe
  }, [])

  return (
    <ConnectivityContext.Provider value={{ isOnline }}>
      {children}
    </ConnectivityContext.Provider>
  )
}

export function useConnectivity() {
  return useContext(ConnectivityContext)
}

// Guard for submit handlers that need the network: returns true when online,
// otherwise alerts the user and returns false so the handler can bail early.
export function useRequireOnline() {
  const { isOnline } = useConnectivity()
  return useCallback(() => {
    if (!isOnline) {
      Alert.alert("You're offline", 'Connect to the internet and try again.')
      return false
    }
    return true
  }, [isOnline])
}
