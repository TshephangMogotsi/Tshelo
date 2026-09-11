import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { AuthStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import CountryPickerModal from '../../components/CountryPickerModal'
import { FEATURED_SIGNUP_COUNTRIES, findSignupCountry } from '../../lib/countries'

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'CountrySelect'>
}

const CARD_SIZE = (Dimensions.get('window').width - 48 - 12) / 2

export default function CountrySelectScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)

  const [selected, setSelected] = useState<string>('BW')
  const [pickerOpen, setPickerOpen] = useState(false)

  const selectedCountry = findSignupCountry(selected) ?? FEATURED_SIGNUP_COUNTRIES[0]
  const selectedIsOther = !FEATURED_SIGNUP_COUNTRIES.some(country => country.code === selected)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Heading ─────────────────────────────── */}
        <Text style={styles.heading}>Create Account</Text>
        <Text style={styles.subheading}>Select your country to get started</Text>

        <Text style={styles.sectionLabel}>WHERE ARE YOU BASED?</Text>

        {/* ── Country grid ────────────────────────── */}
        <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Featured countries">
          {FEATURED_SIGNUP_COUNTRIES.map(country => {
            const active = selected === country.code
            return (
              <TouchableOpacity
                key={country.code}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelected(country.code)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${country.name}, ${country.currency}`}
              >
                <View style={[styles.codeBadge, active && styles.codeBadgeActive]}>
                  <Text style={[styles.codeText, active && styles.codeTextActive]}>
                    {country.code}
                  </Text>
                </View>
                <Text style={[styles.countryName, active && styles.countryNameActive]}>
                  {country.name}
                </Text>
                <Text style={[styles.currencyText, active && styles.currencyTextActive]}>
                  {country.currency} ({country.currencyName})
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={[styles.otherCountry, selectedIsOther && styles.otherCountryActive]}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Choose another country"
          accessibilityHint="Opens a searchable country list"
        >
          <View style={[styles.otherIcon, selectedIsOther && styles.otherIconActive]}>
            <Ionicons name="globe-outline" size={21} color={selectedIsOther ? '#FFFFFF' : colors.primary} />
          </View>
          <View style={styles.otherCopy}>
            <Text style={styles.otherTitle}>{selectedIsOther ? selectedCountry.name : 'Another country'}</Text>
            <Text style={[styles.otherSubtitle, selectedIsOther && styles.otherSubtitleActive]}>
              {selectedIsOther
                ? `${selectedCountry.dialCode} · ${selectedCountry.currency} (${selectedCountry.currencyName})`
                : 'Search the full country list'}
            </Text>
          </View>
          <Ionicons name={selectedIsOther ? 'checkmark-circle' : 'chevron-forward'} size={21} color={colors.primary} />
        </TouchableOpacity>

        {/* ── Continue ────────────────────────────── */}
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={() => navigation.navigate('Register', {
            countryCode:  selectedCountry.code,
            countryName:  selectedCountry.name,
            currency:     selectedCountry.currency,
            flag:         selectedCountry.flag,
            dialCode:     selectedCountry.dialCode,
          })}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>

        {/* ── Sign in link ─────────────────────────── */}
        <View style={styles.signinRow}>
          <Text style={styles.signinText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.signinLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CountryPickerModal
        visible={pickerOpen}
        selectedCode={selected}
        onSelect={country => {
          setSelected(country.code)
          setPickerOpen(false)
        }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 40,
    },

    heading: {
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subheading: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 28,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: 14,
    },

    // ── Grid ───────────────────────────────────────────────────
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 12,
    },
    card: {
      width: CARD_SIZE,
      height: CARD_SIZE,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: 12,
    },
    cardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },

    codeBadge: {
      backgroundColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 4,
    },
    codeBadgeActive: {
      backgroundColor: colors.primary,
    },
    codeText: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textSecondary,
    },
    codeTextActive: {
      color: '#FFFFFF',
    },

    countryName: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    countryNameActive: {
      color: colors.textPrimary,
    },
    currencyText: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
    },
    currencyTextActive: {
      color: colors.primary,
    },
    otherCountry: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 28,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    otherCountryActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    otherIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
    },
    otherIconActive: {
      backgroundColor: colors.primary,
    },
    otherCopy: { flex: 1, minWidth: 0 },
    otherTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    otherSubtitle: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textMuted,
    },
    otherSubtitleActive: {
      color: colors.primary,
    },

    // ── Continue button ────────────────────────────────────────
    continueBtn: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    continueBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // ── Sign in link ───────────────────────────────────────────
    signinRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    signinText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    signinLink: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
  })
}
