import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'EventBudget'>
  route: RouteProp<MainStackParamList, 'EventBudget'>
}

const PRESETS = ['5,000', '10,000', '15,000', '25,000']

export default function EventBudgetScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme()
  const styles = makeStyles(colors)
  const [budget, setBudget] = useState('0')

  function handleBudgetChange(text: string) {
    const cleaned = text.replace(/[^0-9,]/g, '')
    setBudget(cleaned || '0')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Budget &amp; Expenses</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.budgetCard}>
          <Text style={styles.cardTitle}>Set your event budget</Text>

          <View style={styles.amountRow}>
            <Text style={styles.currency}>P</Text>
            <TextInput
              style={styles.amountInput}
              value={budget}
              onChangeText={handleBudgetChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.presetsGrid}>
            {PRESETS.map(value => (
              <TouchableOpacity key={value} style={styles.presetChip} onPress={() => setBudget(value)} activeOpacity={0.82}>
                <Text style={styles.presetText}>P{value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.linkFundCard}>
          <View style={styles.linkFundTop}>
            <View style={styles.linkFundIcon}>
              <Ionicons name="wallet-outline" size={30} color="#16A34A" />
            </View>
            <Text style={styles.linkFundTitle}>Link a contribution fund?</Text>
          </View>
          <Text style={styles.linkFundText}>
            Collect contributions from family &amp; friends to cover the budget. Track who gave what.
          </Text>
          <TouchableOpacity
            style={styles.linkFundButton}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('CreateFund')}
          >
            <Text style={styles.linkFundButtonText}>Link a fund</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.setBudgetButton}
          activeOpacity={0.86}
          onPress={() => Alert.alert('Budget set', `Event budget set to P${budget}.`)}
        >
          <Text style={styles.setBudgetButtonText}>Set Budget</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: 28,
      fontFamily: fonts.display.bold,
      fontWeight: '900',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    headerSpacer: { width: 40 },
    scroll: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 44,
    },
    budgetCard: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 18,
      paddingHorizontal: 22,
      paddingVertical: 26,
      marginBottom: 28,
    },
    cardTitle: {
      fontSize: 21,
      lineHeight: 27,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 28,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 28,
      marginBottom: 24,
    },
    currency: {
      fontSize: 38,
      fontWeight: '900',
      color: colors.textPrimary,
    },
    amountInput: {
      flex: 1,
      fontSize: 58,
      lineHeight: 66,
      fontWeight: '900',
      color: colors.textPrimary,
      paddingVertical: 0,
    },
    divider: {
      height: 1.5,
      backgroundColor: colors.border,
      marginBottom: 22,
    },
    presetsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    presetChip: {
      minWidth: 112,
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F4F4F6',
      borderRadius: 12,
      paddingHorizontal: 18,
    },
    presetText: {
      fontSize: 18,
      color: colors.textSecondary,
    },
    linkFundCard: {
      backgroundColor: '#ECFDF5',
      borderWidth: 2,
      borderColor: '#16A34A',
      borderRadius: 18,
      paddingHorizontal: 22,
      paddingVertical: 24,
      marginBottom: 28,
    },
    linkFundTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      marginBottom: 22,
    },
    linkFundIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#D1FAE5',
    },
    linkFundTitle: {
      flex: 1,
      fontSize: 23,
      lineHeight: 29,
      fontWeight: '900',
      color: '#15803D',
    },
    linkFundText: {
      fontSize: 20,
      lineHeight: 30,
      color: '#15803D',
      marginBottom: 24,
    },
    linkFundButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#16A34A',
      borderRadius: 28,
      paddingVertical: 17,
    },
    linkFundButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    setBudgetButton: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2454D9',
      borderRadius: 28,
      paddingVertical: 17,
    },
    setBudgetButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
}
