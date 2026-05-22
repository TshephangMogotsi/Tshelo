import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../theme/colors'
import { fonts } from '../theme/typography'
import { BOTSWANA_BANKS, Bank } from '../data/botswanaBanks'

type AccountType = 'savings' | 'current'

export type BankFormValue = {
  bankName:      string
  branchCode:    string
  accountNumber: string
  accountType:   AccountType
}

type Props = {
  value:    BankFormValue
  onChange: (v: BankFormValue) => void
}

export default function BankPicker({ value, onChange }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [acctFocused, setAcctFocused] = useState(false)

  const filteredBanks = BOTSWANA_BANKS.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.shortName.toLowerCase().includes(search.toLowerCase())
  )

  function selectBank(bank: Bank) {
    onChange({ ...value, bankName: bank.name, branchCode: bank.branchCode })
    setSearch('')
    setPickerOpen(false)
  }

  function setAccountNumber(n: string) {
    onChange({ ...value, accountNumber: n.replace(/\D/g, '') })
  }

  return (
    <View style={styles.container}>

      {/* ── Bank selector ──────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Bank</Text>
        <TouchableOpacity
          style={styles.bankSelector}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.7}
        >
          {value.bankName ? (
            <View style={styles.bankSelected}>
              <View style={styles.bankInitial}>
                <Text style={styles.bankInitialText}>
                  {value.bankName.charAt(0)}
                </Text>
              </View>
              <View style={styles.bankSelectedInfo}>
                <Text style={styles.bankSelectedName}>{value.bankName}</Text>
                <Text style={styles.bankBranchCode}>Branch code: {value.branchCode}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </View>
          ) : (
            <View style={styles.bankPlaceholder}>
              <Text style={styles.bankPlaceholderText}>Select your bank</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Branch code (read-only, auto-filled) ───── */}
      <View style={styles.field}>
        <Text style={styles.label}>Branch Code</Text>
        <View style={styles.input}>
          <Text style={value.branchCode ? styles.branchCodeValue : styles.branchCodePlaceholder}>
            {value.branchCode || '000000'}
          </Text>
        </View>
      </View>

      {/* ── Account number ─────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Account Number</Text>
        <TextInput
          style={[styles.input, acctFocused && styles.inputFocused]}
          placeholder="e.g. 628000000000"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={value.accountNumber}
          onChangeText={setAccountNumber}
          onFocus={() => setAcctFocused(true)}
          onBlur={() => setAcctFocused(false)}
          maxLength={20}
          returnKeyType="done"
        />
      </View>

      {/* ── Bank picker modal ──────────────────────── */}
      <Modal
        visible={pickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerOpen(false)}
      >
        <SafeAreaView style={styles.modal}>
          <StatusBar barStyle="dark-content" />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Bank</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setPickerOpen(false)}
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search banks…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.bankList}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const isSelected = value.bankName === item.name
              return (
                <TouchableOpacity
                  style={[styles.bankRow, isSelected && styles.bankRowSelected]}
                  onPress={() => selectBank(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.bankRowInitial, isSelected && styles.bankRowInitialSelected]}>
                    <Text style={[styles.bankRowInitialText, isSelected && styles.bankRowInitialTextSelected]}>
                      {item.shortName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.bankRowInfo}>
                    <Text style={[styles.bankRowName, isSelected && styles.bankRowNameSelected]}>
                      {item.name}
                    </Text>
                    <Text style={styles.bankRowCode}>Branch: {item.branchCode}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},

  field: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // ── Bank selector
  bankSelector: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bankPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bankPlaceholderText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  bankSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankInitial: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankInitialText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  bankSelectedInfo: { flex: 1 },
  bankSelectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  bankBranchCode: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // ── Account number
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    color: colors.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },

  branchCodeValue: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  branchCodePlaceholder: {
    fontSize: 16,
    color: colors.textMuted,
  },

  // ── Modal
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: fonts.display.bold,
    color: colors.textPrimary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: 8,
  },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  bankList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 62,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
    borderRadius: 12,
  },
  bankRowSelected: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    marginHorizontal: -6,
  },
  bankRowInitial: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bankRowInitialSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bankRowInitialText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  bankRowInitialTextSelected: {
    color: '#FFFFFF',
  },
  bankRowInfo: { flex: 1 },
  bankRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  bankRowNameSelected: {
    color: colors.primary,
  },
  bankRowCode: {
    fontSize: 12,
    color: colors.textMuted,
  },
})
