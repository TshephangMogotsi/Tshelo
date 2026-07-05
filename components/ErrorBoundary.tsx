import { Component, type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Updates from 'expo-updates'

type Props = { children: ReactNode }
type State = { hasError: boolean }

// Sits above ThemeProvider so it catches crashes anywhere in the tree —
// styling is self-contained (dark, brand purple) rather than themed.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Uncaught error:', error, info.componentStack)
  }

  handleRestart = async () => {
    try {
      await Updates.reloadAsync()
    } catch {
      // reloadAsync is unavailable in dev — reset the boundary instead
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          An unexpected error occurred. Restart the app to continue — your data is safe.
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.handleRestart} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Restart</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1C24',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    color: '#F2F2F7',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#8A8A9A',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#7439E0',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
