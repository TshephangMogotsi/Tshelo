import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import appConfig from '../../app.json'
import { useTheme } from '../../context/ThemeContext'
import { openLegalDocument, type LegalDocument } from '../../lib/legalDocuments'
import type { MainStackParamList } from '../../navigation/types'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'AboutLegal'>
}

const LEGAL_DOCUMENTS: Array<{
  document: LegalDocument
  label: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
}> = [
  {
    document: 'terms',
    label: 'Terms of Service',
    description: 'The rules and responsibilities for using Tshelo.',
    icon: 'document-text-outline',
  },
  {
    document: 'privacy',
    label: 'Privacy Policy',
    description: 'How Tshelo handles and protects your information.',
    icon: 'shield-checkmark-outline',
  },
]

export default function AboutLegalScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={23} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About &amp; Legal</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <Image
            source={require('../../assets/tshelo-icon.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Tshelo logo"
          />
          <Text style={styles.appName}>Tshelo</Text>
          <Text style={styles.tagline}>Plan together. Contribute transparently.</Text>
          <Text style={styles.description}>
            Tshelo helps families, friends, and communities organise funds and events with a clear shared record.
          </Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version {appConfig.expo.version}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>LEGAL</Text>
        <View style={styles.legalCard}>
          {LEGAL_DOCUMENTS.map((item, index) => (
            <TouchableOpacity
              key={item.document}
              style={[styles.legalRow, index < LEGAL_DOCUMENTS.length - 1 && styles.legalRowBorder]}
              onPress={() => { void openLegalDocument(item.document) }}
              activeOpacity={0.75}
              accessibilityRole="link"
              accessibilityLabel={`Open ${item.label}`}
            >
              <View style={styles.legalIcon}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={styles.legalCopy}>
                <Text style={styles.legalTitle}>{item.label}</Text>
                <Text style={styles.legalDescription}>{item.description}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.legalNote}>
          These documents open securely inside Tshelo and remain current with the Tshelo website.
        </Text>
        <Text style={styles.copyright}>© 2026 Tshelo. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    backButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    headerSpacer: { width: 42 },
    scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 48 },
    aboutCard: {
      paddingHorizontal: 24,
      paddingVertical: 26,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
    },
    logo: { width: 64, height: 64 },
    appName: {
      marginTop: 12,
      fontSize: 28,
      lineHeight: 34,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    tagline: {
      marginTop: 5,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    description: {
      marginTop: 14,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    versionBadge: {
      marginTop: 18,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.primaryLight,
    },
    versionText: { fontSize: 11, fontWeight: '800', color: colors.primary },
    sectionLabel: {
      marginTop: 26,
      marginBottom: 9,
      paddingHorizontal: 4,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '800',
      letterSpacing: 1.4,
      color: colors.textMuted,
    },
    legalCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    legalRow: {
      minHeight: 82,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    legalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    legalIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legalCopy: { flex: 1, minWidth: 0 },
    legalTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: colors.textPrimary },
    legalDescription: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.textMuted },
    legalNote: {
      marginTop: 14,
      paddingHorizontal: 5,
      fontSize: 11,
      lineHeight: 17,
      color: colors.textMuted,
      textAlign: 'center',
    },
    copyright: {
      marginTop: 28,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
      textAlign: 'center',
    },
  })
}
