import { ActivityIndicator, StyleSheet, View } from 'react-native'

// Data-refresh indicator: the page underneath stays visible behind a
// low-opacity black veil instead of being swapped for a blank screen.
export default function LoadingOverlay() {
  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
})
