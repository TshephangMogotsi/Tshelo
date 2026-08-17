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
import Ionicons from '@expo/vector-icons/Ionicons'
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
  value:     BankFormValue
  onChange:  (v: BankFormValue) => void
  isDark?:   boolean
  inputBg?:  string
  textCol?:  string
  mutedCol?: string
  borderCol?: string
}

export default function BankPicker({ value, onChange, isDark = false, inputBg, textCol, mutedCol, borderCol }: Props) {
  const _inputBg   = inputBg   ?? (isDark ? '#2D2E41' : colors.surface)
  const _textCol   = textCol   ?? (isDark ? '#F2F2F7' : colors.textPrimary)
  const _mutedCol  = mutedCol  ?? (isDark ? '#8A8A9A' : colors.textMuted)
  const _borderCol = borderCol ?? (isDark ? '#3A3A5C' : colors.border)

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
        <Text style={[styles.label, { color: _textCol }]}>Bank</Text>
        <TouchableOpacity
          style={[styles.bankSelector, { backgroundColor: _inputBg, borderColor: _borderCol }]}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.7}
        >
          {value.bankName ? (
            <View style={styles.bankSelected}>
              <View style={styles.bankInitial}>
                <Text style={styles.bankInitialText}>{value.bankName.charAt(0)}</Text>
              </View>
              <View style={styles.bankSelectedInfo}>
                <Text style={[styles.bankSelectedName, { color: _textCol }]}>{value.bankName}</Text>
                <Text style={[styles.bankBranchCode, { color: _mutedCol }]}>Branch code: {value.branchCode}</Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={_mutedCol} />
            </View>
          ) : (
            <View style={styles.bankPlaceholder}>
              <Text style={[styles.bankPlaceholderText, { color: _mutedCol }]}>Select your bank</Text>
              <Ionicons name="chevron-down" size={18} color={_mutedCol} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Branch code (read-only, auto-filled) ───── */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: _textCol }]}>Branch Code</Text>
        <View style={[styles.input, { backgroundColor: _inputBg, borderColor: _borderCol }]}>
          <Text style={{ color: value.branchCode ? _textCol : _mutedCol, fontSize: 16 }}>
            {value.branchCode || '000000'}
          </Text>
        </View>
      </View>

      {/* ── Account number ─────────────────────────── */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: _textCol }]}>Account Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: _inputBg, borderColor: acctFocused ? colors.primary : _borderCol, color: _textCol }]}
          placeholder="e.g. 628000000000"
          placeholderTextColor={_mutedCol}
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
        <SafeAreaView style={[styles.modal, { backgroundColor: isDark ? '#1A1C24' : colors.background }]}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

          <View style={[styles.modalHeader, { backgroundColor: _inputBg, borderBottomColor: _borderCol }]}>
            <Text style={[styles.modalTitle, { color: _textCol }]}>Select Bank</Text>
            <TouchableOpacity
              style={[styles.modalClose, { backgroundColor: isDark ? '#1A1C24' : colors.background }]}
              onPress={() => setPickerOpen(false)}
            >
              <Ionicons name="close" size={20} color={_textCol} />
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: _inputBg, borderColor: _borderCol }]}>
            <Ionicons name="search-outline" size={18} color={_mutedCol} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: _textCol }]}
              placeholder="Search banks…"
              placeholderTextColor={_mutedCol}
              value={search}
              onChangeText={setSearch}
              autoFocus
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={_mutedCol} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.bankList}
            ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: _borderCol }]} />}
            renderItem={({ item }) => {
              const isSelected = value.bankName === item.name
              return (
                <TouchableOpacity
                  style={[styles.bankRow, isSelected && styles.bankRowSelected]}
                  onPress={() => selectBank(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.bankRowInitial, { backgroundColor: _inputBg, borderColor: _borderCol }, isSelected && styles.bankRowInitialSelected]}>
                    <Text style={[styles.bankRowInitialText, { color: _textCol }, isSelected && styles.bankRowInitialTextSelected]}>
                      {item.shortName.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.bankRowInfo}>
                    <Text style={[styles.bankRowName, { color: _textCol }, isSelected && styles.bankRowNameSelected]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.bankRowCode, { color: _mutedCol }]}>Branch: {item.branchCode}</Text>
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
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // ── Bank selector
  bankSelector: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
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
