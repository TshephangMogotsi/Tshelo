import { View, Text, StyleSheet, StatusBar, ScrollView, TouchableOpacity, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { fonts } from '../../../theme/typography'

type Props = {
  visible: boolean
  onDismiss: () => void
  onCreateFirstFund: () => void
}

export default function WelcomeOverlay({ visible, onDismiss, onCreateFirstFund }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={styles.welcomeScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.welcomeCircle}>
            <Text style={styles.welcomeEmoji}>🎉</Text>
          </View>

          <Text style={styles.welcomeHeading}>Welcome to Tshelo!</Text>
          <Text style={styles.welcomeSub}>
            Create your first fund and start collecting contributions with full transparency.
          </Text>

          <View style={styles.featuresCard}>
            <Text style={styles.featuresCardTitle}>Your first fund is FREE</Text>
            {[
              'SMS payment detection',
              'Full transparency for all members',
              'Receipt scanning',
              'Export PDF reports',
            ].map(feature => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Ionicons name="checkmark" size={13} color="#059669" />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.welcomeButton}
            onPress={onCreateFirstFund}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.welcomeButtonText}>Create Your First Fund</Text>
          </TouchableOpacity>

          <Text style={styles.welcomeNote}>No credit card required</Text>

          <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} style={styles.welcomeSkipBtn}>
            <Text style={styles.welcomeSkipText}>I'll do this later</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    welcomeScroll: {
      flexGrow: 1,
      paddingHorizontal: 28,
      paddingTop: 32,
      paddingBottom: 48,
      alignItems: 'center',
    },
    welcomeCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 32,
    },
    welcomeEmoji:   { fontSize: 72 },
    welcomeHeading: {
      fontSize: 26,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 12,
    },
    welcomeSub: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 32,
    },
    featuresCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      width: '100%',
      marginBottom: 24,
      gap: 14,
    },
    featuresCardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    featureCheck: {
      width: 26,
      height: 26,
      borderRadius: 6,
      backgroundColor: '#D1FAE5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureText: {
      fontSize: 14,
      color: colors.textPrimary,
      flex: 1,
    },
    welcomeButton: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingVertical: 17,
      paddingHorizontal: 28,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      width: '100%',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
      marginBottom: 12,
    },
    welcomeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    welcomeNote: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    welcomeSkipBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 20,
    },
    welcomeSkipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
  })
}
