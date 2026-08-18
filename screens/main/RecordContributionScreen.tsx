import { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RouteProp } from '@react-navigation/native'
import { MainStackParamList } from '../../navigation/types'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useRequireOnline } from '../../context/ConnectivityContext'
import { api } from '../../lib/api'
import { hapticSuccess, hapticError } from '../../lib/haptics'
import ProviderLogo from '../../components/ProviderLogo'
import { detectProvider, type MobileMoneyProvider } from '../../lib/providers'
import type { AppColors } from '../../theme/themes'
import { fonts } from '../../theme/typography'
import { useFundPermissions } from '../../lib/useFundPermissions'

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'RecordContribution'>
  route: RouteProp<MainStackParamList, 'RecordContribution'>
}

type ContributionSource  = 'sms_detected' | 'manual'
type ContributionMode = 'pledge' | 'received'

const PROVIDERS: { id: MobileMoneyProvider; label: string; color: string }[] = [
  { id: 'orange_money', label: 'Orange Money', color: '#FF6B00' },
  { id: 'myzaka',       label: 'MyZaka',       color: '#009FE3' },
  { id: 'smega',        label: 'Smega',        color: '#8B2FC9' },
]

const MAX_CONTRIBUTION_BWP = 10000

type ContributorOption = {
  key: string
  contributorId: string | null
  memberId: string | null
  userId: string | null
  name: string
  phone: string
  kind: 'member' | 'guest'
}

type OpenPledge = {
  pledge_id: string
  pledged_amount: number
  allocated_amount: number
  outstanding_amount: number
  pledge_state: 'pledged' | 'partially_paid' | 'fulfilled'
}

type ClaimedSponsorshipItem = {
  id: string
  title: string
  target_amount: number
  allocated_amount: number
  outstanding_amount: number
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('267') ? digits.slice(3) : digits
}

export default function RecordContributionScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme()
  const { userId } = useAuth()
  const requireOnline = useRequireOnline()
  const styles = makeStyles(colors)

  const {
    fundId,
    fundTitle,
    currencyCode,
    initialMode = 'received',
    sponsorshipItemId,
    sponsorUserId,
  } = route.params

  const [entryMode, setEntryMode]             = useState<ContributionMode>(initialMode)
  const [source, setSource]                   = useState<ContributionSource>('manual')
  const [contributorName, setContributorName] = useState('')
  const [contributorPhone, setContributorPhone] = useState('')
  const [amountBWP, setAmountBWP]             = useState('')
  const [providerOverride, setProviderOverride] = useState<MobileMoneyProvider | null>(null)
  const [showProviderPicker, setShowProviderPicker] = useState(false)
  const [notes, setNotes]                     = useState('')
  const [smsSnippet, setSmsSnippet]           = useState('')
  const [isSaving, setIsSaving]               = useState(false)
  const [contributorOptions, setContributorOptions] = useState<ContributorOption[]>([])
  const [selectedContributorKey, setSelectedContributorKey] = useState<string | null>(null)
  const [openPledges, setOpenPledges]         = useState<OpenPledge[]>([])
  const [selectedPledgeId, setSelectedPledgeId] = useState<string | null>(null)
  const [isLoadingPledges, setIsLoadingPledges] = useState(false)
  const [claimedSponsorshipItems, setClaimedSponsorshipItems] = useState<ClaimedSponsorshipItem[]>([])
  const [selectedSponsorshipItemId, setSelectedSponsorshipItemId] = useState<string | null>(null)
  const [isLoadingSponsorships, setIsLoadingSponsorships] = useState(false)
  const [isNameFocused, setIsNameFocused]     = useState(false)
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { can, isLoading: permissionsLoading } = useFundPermissions(fundId)
  const canRecordReceived = permissionsLoading ? null : can('record_contributions')
  const canManageSponsorships = can('manage_sponsorships')

  useEffect(() => {
    let active = true
    async function loadMembers() {
      if (!userId || permissionsLoading) return
      const [memberRows, contributorRows] = await Promise.all([
        api.funds.listMembers(fundId),
        api.contributions.listContributors(fundId),
      ])

      if (!active) return

      const manager = canRecordReceived === true
      if (!manager) setEntryMode('pledge')

      const contributorByUserId = new Map(
        contributorRows
          .filter(row => Boolean(row.user_id))
          .map(row => [row.user_id as string, row])
      )

      const memberOptions: ContributorOption[] = memberRows
        .flatMap(m => {
          const memberUserId = m.user_id
          if (!memberUserId) return []
          const contributor = contributorByUserId.get(memberUserId)
          return [{
            key: `member:${m.id}`,
            contributorId: contributor?.id ?? null,
            memberId: m.id,
            userId: memberUserId,
            name: m.display_name,
            phone: m.phone ?? contributor?.phone ?? '',
            kind: 'member' as const,
          }]
        })

      const guestOptions: ContributorOption[] = contributorRows
        .filter(row => !row.user_id)
        .map(row => ({
          key: `guest:${row.id}`,
          contributorId: row.id,
          memberId: null,
          userId: null,
          name: row.display_name,
          phone: row.phone,
          kind: 'guest' as const,
        }))

      const options = [...memberOptions, ...guestOptions]

      setContributorOptions(options)
      if (manager && sponsorUserId) {
        const sponsor = options.find(option => option.userId === sponsorUserId)
        if (sponsor) {
          setSelectedContributorKey(sponsor.key)
          setContributorName(sponsor.name)
          setContributorPhone(sponsor.phone)
        }
      } else if (!manager) {
        const self = options.find(option => option.userId === userId)
        if (self) {
          setSelectedContributorKey(self.key)
          setContributorName(self.name)
          setContributorPhone(self.phone)
        }
      }
    }
    loadMembers().catch(() => { if (active) setContributorOptions([]) })
    return () => { active = false }
  }, [canRecordReceived, fundId, permissionsLoading, sponsorUserId, userId])

  useEffect(() => {
    return () => { if (blurTimeout.current) clearTimeout(blurTimeout.current) }
  }, [])

  const selectedContributor = contributorOptions.find(option => option.key === selectedContributorKey) ?? null
  const normalizedEnteredPhone = normalizePhone(contributorPhone)
  const matchingSavedContributors = selectedContributor
    ? []
    : contributorOptions.filter(option =>
        normalizedEnteredPhone.length >= 7
        && normalizePhone(option.phone) === normalizedEnteredPhone
      )
  const matchingSavedContributor = matchingSavedContributors.length === 1
    ? matchingSavedContributors[0]
    : null

  useEffect(() => {
    let active = true
    const contributorId = selectedContributor?.contributorId

    if (entryMode !== 'received' || !contributorId) {
      setOpenPledges([])
      setSelectedPledgeId(null)
      setIsLoadingPledges(false)
      return () => { active = false }
    }

    setIsLoadingPledges(true)
    setSelectedPledgeId(null)
    api.contributions.listPledgeBalances(fundId, contributorId)
      .then(data => {
        if (!active) return
        setOpenPledges(data.filter(pledge => Number(pledge.outstanding_amount) > 0).map(pledge => ({
          pledge_id: pledge.pledge_id,
          pledged_amount: Number(pledge.pledged_amount ?? 0),
          allocated_amount: Number(pledge.allocated_amount ?? 0),
          outstanding_amount: Number(pledge.outstanding_amount ?? 0),
          pledge_state: pledge.pledge_state,
        })))
        setIsLoadingPledges(false)
      })
      .catch(() => { if (active) setIsLoadingPledges(false) })

    return () => { active = false }
  }, [entryMode, fundId, selectedContributor?.contributorId])

  useEffect(() => {
    let active = true
    const selectedUserId = selectedContributor?.userId

    if (entryMode !== 'received' || !selectedUserId || !canManageSponsorships) {
      setClaimedSponsorshipItems([])
      setSelectedSponsorshipItemId(null)
      setIsLoadingSponsorships(false)
      return () => { active = false }
    }

    setIsLoadingSponsorships(true)
    api.funds.listSponsorships(fundId)
      .then(data => {
        if (!active) return
        const loaded = data
          .filter(item => item.claimed_by_user_id === selectedUserId && ['claimed', 'funded'].includes(item.status) && Number(item.outstanding_amount) > 0)
          .map(item => ({
          id: item.id,
          title: item.title,
          target_amount: Number(item.target_amount ?? 0),
          allocated_amount: Number(item.allocated_amount ?? 0),
          outstanding_amount: Number(item.outstanding_amount ?? 0),
        }))
        setClaimedSponsorshipItems(loaded)
        if (sponsorshipItemId && loaded.some(item => item.id === sponsorshipItemId)) {
          setSelectedSponsorshipItemId(sponsorshipItemId)
        } else if (loaded.length === 1) {
          setSelectedSponsorshipItemId(loaded[0].id)
        } else {
          setSelectedSponsorshipItemId(null)
        }
        setIsLoadingSponsorships(false)
      })
      .catch(() => { if (active) setIsLoadingSponsorships(false) })

    return () => { active = false }
  }, [canManageSponsorships, entryMode, fundId, selectedContributor?.userId, sponsorshipItemId])

  function handlePickContributor(contributor: ContributorOption) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setSelectedContributorKey(contributor.key)
    setContributorName(contributor.name)
    setContributorPhone(contributor.phone)
    setProviderOverride(null)
    setShowProviderPicker(false)
    setIsNameFocused(false)
  }

  function handleNameChange(text: string) {
    setContributorName(text)
    setSelectedContributorKey(null)
  }

  function handleNameFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current)
    setIsNameFocused(true)
  }

  function handleNameBlur() {
    blurTimeout.current = setTimeout(() => setIsNameFocused(false), 150)
  }

  const nameSuggestions = selectedContributorKey
    ? []
    : contributorOptions.filter(option =>
        contributorName.trim().length > 0 &&
        option.name.toLowerCase().includes(contributorName.trim().toLowerCase())
      )
  const showSuggestions = isNameFocused && nameSuggestions.length > 0

  const detectedProvider = detectProvider(contributorPhone)
  const provider = providerOverride ?? detectedProvider
  const selectedProvider = provider ? PROVIDERS.find(option => option.id === provider) ?? null : null

  const parsedAmount = parseFloat(amountBWP.replace(/,/g, ''))
  const amountValid  = !isNaN(parsedAmount) && parsedAmount > 0 && parsedAmount <= MAX_CONTRIBUTION_BWP
  const isPledge = entryMode === 'pledge'

  const isValid =
    canRecordReceived !== null &&
    (isPledge || canRecordReceived) &&
    contributorName.trim().length >= 2 &&
    contributorPhone.trim().length >= 7 &&
    amountValid &&
    !isLoadingPledges &&
    !isLoadingSponsorships &&
    (isPledge || openPledges.length <= 1 || selectedPledgeId !== null) &&
    (isPledge || (
      provider !== null &&
      (source === 'manual' || smsSnippet.trim().length > 0)
    ))

  function handleAmountChange(text: string) {
    setAmountBWP(text.replace(/[^0-9.]/g, ''))
  }

  function handlePhoneChange(text: string) {
    setContributorPhone(text)
    setProviderOverride(null)
    setShowProviderPicker(false)
    setSelectedContributorKey(null)
  }

  function handleProviderSelect(providerId: MobileMoneyProvider) {
    if (isSaving) return
    setProviderOverride(providerId)
    setShowProviderPicker(false)
  }

  async function performSave() {
    if (!isValid || isSaving || !userId) return
    if (!requireOnline()) return
    setIsSaving(true)

    try {
      const savedContribution = await api.contributions.create({
          fund_id: fundId,
          contributor_id: selectedContributor?.contributorId ?? null,
          contributor_user_id: selectedContributor?.userId ?? null,
          contributor_name: contributorName.trim(),
          contributor_phone: contributorPhone.trim(),
          amount: String(parsedAmount),
          pledged_amount: isPledge ? String(parsedAmount) : null,
          currency_code: currencyCode,
          payment_method: isPledge ? null : provider,
          detected_via: !isPledge && source === 'sms_detected' ? 'sms' : 'manual',
          status: isPledge ? 'pledged' : 'confirmed',
          // The pasted SMS is used only for on-device review/provider detection.
          // Raw message bodies can contain balances and are never stored.
          notes: notes.trim() || null,
        })

      const selectedOpenPledge = openPledges.find(pledge => pledge.pledge_id === selectedPledgeId)
      if (!isPledge && openPledges.length > 1 && selectedOpenPledge && savedContribution) {
        try {
          await api.contributions.createPledgeAllocation({
          fund_id: fundId,
          contributor_id: savedContribution.contributor_id,
          pledge_contribution_id: selectedOpenPledge.pledge_id,
          payment_contribution_id: savedContribution.id,
          amount: String(Math.min(parsedAmount, selectedOpenPledge.outstanding_amount)),
          })
        } catch {
          hapticError()
          Alert.alert(
            'Contribution saved without allocation',
            'The money was recorded safely, but it could not be applied to the selected pledge. It remains available for an organiser to reconcile.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          )
          return
        }
      }

      const selectedSponsorshipItem = claimedSponsorshipItems.find(
        item => item.id === selectedSponsorshipItemId
      )
      if (!isPledge && canManageSponsorships && selectedSponsorshipItem && savedContribution) {
        try {
          await api.contributions.createSponsorshipAllocation({
            fund_id: fundId,
            sponsorship_item_id: selectedSponsorshipItem.id,
            contribution_id: savedContribution.id,
            amount: String(Math.min(parsedAmount, selectedSponsorshipItem.outstanding_amount)),
          })
        } catch {
          hapticError()
          Alert.alert(
            'Contribution saved without item allocation',
            'The money was recorded safely, but it could not be applied to the sponsorship item. The organiser can reconcile it later.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          )
          return
        }
      }

      hapticSuccess()
      navigation.goBack()
    } catch (e) {
      hapticError()
      Alert.alert(
        isPledge ? 'Could not save pledge' : 'Could not save contribution',
        e instanceof Error ? e.message : 'Please try again.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  function handleSave() {
    if (!isValid || isSaving || !userId) return

    if (matchingSavedContributor) {
      Alert.alert(
        'Contributor already exists',
        `${matchingSavedContributor.name} already uses this phone number in the fund. Use the existing ${matchingSavedContributor.kind} profile so the financial history stays together.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Use Existing', onPress: () => handlePickContributor(matchingSavedContributor) },
        ]
      )
      return
    }

    if (matchingSavedContributors.length > 1) {
      Alert.alert(
        'Choose the contributor',
        'More than one saved contributor uses this phone number. Select the correct person from the contributor search before saving.',
      )
      return
    }

    if (!selectedContributor && canRecordReceived) {
      Alert.alert(
        'Add guest contributor?',
        `${contributorName.trim()} is not currently linked to a member or saved contributor in this fund. A guest contributor profile will be created to keep their pledges and payments together. This will not give them access to the fund.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Guest', onPress: performSave },
        ]
      )
      return
    }

    performSave()
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ─────────────────────────────── */}
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.heading}>{isPledge ? 'Make a Pledge' : 'Record Contribution'}</Text>
            <Text style={styles.subheading} numberOfLines={1}>
              {fundTitle}
            </Text>
          </View>

          {/* ── Pledge / received toggle ───────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Record as</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeOption, isPledge && styles.modeOptionActive]}
                onPress={() => setEntryMode('pledge')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modeTitle, isPledge && styles.modeTitleActive]}>Pledge</Text>
                <Text style={styles.modeHint}>A promise to contribute later</Text>
              </TouchableOpacity>
              {canRecordReceived && (
                <TouchableOpacity
                  style={[styles.modeOption, !isPledge && styles.modeOptionActive]}
                  onPress={() => setEntryMode('received')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeTitle, !isPledge && styles.modeTitleActive]}>Received</Text>
                  <Text style={styles.modeHint}>Money already received</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Source toggle ──────────────────────── */}
          {!isPledge && <View style={styles.field}>
            <Text style={styles.label}>How was this received?</Text>
            <View style={styles.sourceToggle}>
              <TouchableOpacity
                style={[styles.sourceOption, source === 'manual' && styles.sourceOptionActive]}
                onPress={() => setSource('manual')}
                activeOpacity={0.8}
              >
                <Text style={styles.sourceOptionEmoji}>✍️</Text>
                <Text style={[
                  styles.sourceOptionText,
                  source === 'manual' && styles.sourceOptionTextActive,
                ]}>
                  Manual Entry
                </Text>
                <Text style={[
                  styles.sourceOptionHint,
                  source === 'manual' && { color: colors.primary },
                ]}>
                  Cash or undetected
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sourceOption, source === 'sms_detected' && styles.sourceOptionActive]}
                onPress={() => setSource('sms_detected')}
                activeOpacity={0.8}
              >
                <Text style={styles.sourceOptionEmoji}>📱</Text>
                <Text style={[
                  styles.sourceOptionText,
                  source === 'sms_detected' && styles.sourceOptionTextActive,
                ]}>
                  SMS Detected
                </Text>
                <Text style={[
                  styles.sourceOptionHint,
                  source === 'sms_detected' && { color: colors.primary },
                ]}>
                  From mobile money SMS
                </Text>
              </TouchableOpacity>
            </View>
          </View>}

          {/* ── SMS snippet (conditional) ──────────── */}
          {!isPledge && source === 'sms_detected' && (
            <View style={styles.field}>
              <Text style={styles.label}>SMS Text</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Paste the mobile money SMS here…"
                placeholderTextColor={colors.textMuted}
                value={smsSnippet}
                onChangeText={setSmsSnippet}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>
                Used on this device to confirm the payment details. The raw SMS is not stored.
              </Text>
            </View>
          )}

          {/* ── Contributor name ───────────────────── */}
          <View style={[styles.field, styles.nameFieldWrap]}>
            <Text style={styles.label}>Who is this for?</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mpho Dube"
              placeholderTextColor={colors.textMuted}
              value={contributorName}
              onChangeText={handleNameChange}
              onFocus={handleNameFocus}
              onBlur={handleNameBlur}
              autoCapitalize="words"
              returnKeyType="next"
              editable={!isSaving && canRecordReceived !== false}
            />
            {selectedContributor && (
              <Text style={styles.hint}>
                ✓ Using saved {selectedContributor.kind === 'member' ? 'fund member' : 'guest contributor'} profile.
              </Text>
            )}
            {canRecordReceived && showSuggestions && (
              <View style={styles.suggestDropdown}>
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.suggestScroll} nestedScrollEnabled>
                  {nameSuggestions.map(contributor => (
                    <TouchableOpacity
                      key={contributor.key}
                      style={styles.suggestRow}
                      onPress={() => handlePickContributor(contributor)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.quickPickAvatar}>
                        <Text style={styles.quickPickAvatarText}>
                          {contributor.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.suggestBody}>
                        <View style={styles.suggestNameRow}>
                          <Text style={styles.suggestName} numberOfLines={1}>{contributor.name}</Text>
                          <View style={styles.contributorTypeBadge}>
                            <Text style={styles.contributorTypeBadgeText}>
                              {contributor.kind === 'member' ? 'Member' : 'Guest'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.suggestPhone} numberOfLines={1}>{contributor.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* ── Contributor phone ──────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Contributor Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 71234567"
              placeholderTextColor={colors.textMuted}
              value={contributorPhone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              returnKeyType="next"
              editable={!isSaving && canRecordReceived !== false}
            />
            {contributorPhone.trim().length >= 2 && (
              selectedProvider ? (
                <View style={styles.detectedRow}>
                  <Text style={[styles.hint, { color: selectedProvider.color, fontWeight: '700' }]}>
                    ✓ {selectedProvider.label} {providerOverride ? 'selected' : 'detected'}
                  </Text>
                  {detectedProvider && !showProviderPicker && (
                    <TouchableOpacity onPress={() => setShowProviderPicker(true)} disabled={isSaving}>
                      <Text style={styles.changeProviderText}>{providerOverride ? 'Change' : 'Not correct?'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <Text style={styles.hint}>Could not detect a provider from this number — select one below.</Text>
              )
            )}
            {canRecordReceived && matchingSavedContributor && (
              <TouchableOpacity
                style={styles.existingContributorCard}
                onPress={() => handlePickContributor(matchingSavedContributor)}
                activeOpacity={0.8}
              >
                <View style={styles.existingContributorBody}>
                  <Text style={styles.existingContributorTitle}>Existing contributor found</Text>
                  <Text style={styles.existingContributorText}>
                    {matchingSavedContributor.name} · {matchingSavedContributor.kind === 'member' ? 'Member' : 'Guest'}
                  </Text>
                </View>
                <Text style={styles.existingContributorAction}>Use profile</Text>
              </TouchableOpacity>
            )}
            {canRecordReceived && matchingSavedContributors.length > 1 && (
              <View style={styles.ambiguousContributorCard}>
                <Text style={styles.ambiguousContributorTitle}>Multiple matches found</Text>
                <Text style={styles.ambiguousContributorText}>
                  Select the correct person by name. The app will not merge contributors from a phone number alone.
                </Text>
              </View>
            )}
          </View>

          {/* ── Amount ─────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>{isPledge ? 'Pledged amount' : 'Amount received'} (P)</Text>
            <View style={styles.currencyRow}>
              <View style={styles.currencyPrefix}>
                <Text style={styles.currencySymbol}>P</Text>
              </View>
              <TextInput
                style={styles.currencyInput}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                value={amountBWP}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                returnKeyType="next"
                editable={!isSaving}
              />
            </View>
            {amountBWP !== '' && !amountValid && (
              <Text style={styles.errorText}>
                {parsedAmount > MAX_CONTRIBUTION_BWP
                  ? `Exceeds sandbox cap of P ${MAX_CONTRIBUTION_BWP.toLocaleString()}`
                  : 'Enter a valid amount'}
              </Text>
            )}
          </View>

          {!isPledge && openPledges.length === 1 && (
            <View style={styles.autoAllocationCard}>
              <Text style={styles.autoAllocationTitle}>Pledge matched automatically</Text>
              <Text style={styles.autoAllocationText}>
                This payment will be applied to the outstanding pledge of P {openPledges[0].outstanding_amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
              </Text>
            </View>
          )}

          {!isPledge && openPledges.length > 1 && (
            <View style={styles.multiplePledgesCard}>
              <Text style={styles.multiplePledgesTitle}>Multiple outstanding pledges</Text>
              <Text style={styles.multiplePledgesText}>
                Choose the pledge this payment should reduce.
              </Text>
              <View style={styles.pledgeChoiceList}>
                {openPledges.map((pledge, index) => {
                  const isSelected = selectedPledgeId === pledge.pledge_id
                  return (
                    <TouchableOpacity
                      key={pledge.pledge_id}
                      style={[styles.pledgeChoice, isSelected && styles.pledgeChoiceSelected]}
                      onPress={() => setSelectedPledgeId(pledge.pledge_id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.pledgeChoiceBody}>
                        <Text style={[styles.pledgeChoiceTitle, isSelected && styles.pledgeChoiceTitleSelected]}>
                          Pledge {index + 1}
                        </Text>
                        <Text style={styles.pledgeChoiceAmount}>
                          P {pledge.outstanding_amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding
                        </Text>
                      </View>
                      <Text style={[styles.pledgeChoiceIndicator, isSelected && styles.pledgeChoiceIndicatorSelected]}>
                        {isSelected ? '✓' : '○'}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          {!isPledge && claimedSponsorshipItems.length > 0 && (
            <View style={styles.sponsorshipAllocationCard}>
              <Text style={styles.sponsorshipAllocationTitle}>Sponsorship item</Text>
              <Text style={styles.sponsorshipAllocationText}>
                Choose whether this payment should fund an item this member claimed.
              </Text>
              <TouchableOpacity
                style={[
                  styles.pledgeChoice,
                  selectedSponsorshipItemId === null && styles.pledgeChoiceSelected,
                  { marginTop: 10 },
                ]}
                onPress={() => setSelectedSponsorshipItemId(null)}
              >
                <View style={styles.pledgeChoiceBody}>
                  <Text style={[
                    styles.pledgeChoiceTitle,
                    selectedSponsorshipItemId === null && styles.pledgeChoiceTitleSelected,
                  ]}>
                    General contribution
                  </Text>
                  <Text style={styles.pledgeChoiceAmount}>Do not allocate this payment to an item</Text>
                </View>
                <Text style={[
                  styles.pledgeChoiceIndicator,
                  selectedSponsorshipItemId === null && styles.pledgeChoiceIndicatorSelected,
                ]}>
                  {selectedSponsorshipItemId === null ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
              <View style={styles.pledgeChoiceList}>
                {claimedSponsorshipItems.map(item => {
                  const isSelected = selectedSponsorshipItemId === item.id
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.pledgeChoice, isSelected && styles.pledgeChoiceSelected]}
                      onPress={() => setSelectedSponsorshipItemId(item.id)}
                    >
                      <View style={styles.pledgeChoiceBody}>
                        <Text style={[styles.pledgeChoiceTitle, isSelected && styles.pledgeChoiceTitleSelected]}>
                          {item.title}
                        </Text>
                        <Text style={styles.pledgeChoiceAmount}>
                          P {item.outstanding_amount.toLocaleString('en-BW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} outstanding
                        </Text>
                      </View>
                      <Text style={[styles.pledgeChoiceIndicator, isSelected && styles.pledgeChoiceIndicatorSelected]}>
                        {isSelected ? '✓' : '○'}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          )}

          {/* ── Provider (only shown when auto-detect needs help) ── */}
          {!isPledge && (!detectedProvider || showProviderPicker) && (
            <View style={styles.field}>
              <Text style={styles.label}>Mobile Money Provider</Text>
              <View style={styles.providerRow}>
                {PROVIDERS.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.providerChip,
                      provider === p.id && { borderColor: p.color, backgroundColor: p.color + '14' },
                    ]}
                    onPress={() => handleProviderSelect(p.id)}
                    activeOpacity={0.8}
                    disabled={isSaving}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: provider === p.id, disabled: isSaving }}
                    accessibilityLabel={`Use ${p.label}`}
                  >
                    <ProviderLogo provider={p.id} width={50} />
                    <Text style={[
                      styles.providerChipLabel,
                      provider === p.id && { color: p.color, fontWeight: '700' },
                    ]}>
                      {p.label}
                    </Text>
                    {provider === p.id && (
                      <Text style={[styles.providerCheck, { color: p.color }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Notes ──────────────────────────────── */}
          <View style={styles.field}>
            <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any additional context…"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              maxLength={200}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isSaving}
            />
            <Text style={styles.charCount}>{notes.length}/200</Text>
          </View>

          {/* ── Audit note ─────────────────────────── */}
          <View style={styles.auditCard}>
            <Text style={styles.auditText}>
              🔒 This {isPledge ? 'pledge' : 'contribution'} will be recorded in the fund's audit log with your name and a timestamp. It cannot be deleted.
            </Text>
          </View>

          {/* ── Submit ─────────────────────────────── */}
          <TouchableOpacity
            style={[styles.primaryButton, isValid && !isSaving && styles.buttonActive]}
            activeOpacity={isValid && !isSaving ? 0.85 : 1}
            onPress={handleSave}
            disabled={isSaving || !isValid}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.primaryButtonText, isValid && styles.primaryButtonTextActive]}>
                {isPledge ? 'Save Pledge' : 'Save Contribution'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 16,
      paddingBottom: 48,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backIcon: {
      fontSize: 20,
      color: colors.textPrimary,
    },
    header: {
      marginBottom: 28,
    },
    heading: {
      fontSize: 30,
      fontFamily: fonts.display.bold,
      color: colors.heading,
      marginBottom: 4,
    },
    subheading: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    field: {
      marginBottom: 22,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    optional: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'none',
      fontWeight: '400',
      letterSpacing: 0,
    },
    sourceToggle: {
      flexDirection: 'row',
      gap: 10,
    },
    modeToggle: {
      flexDirection: 'row',
      gap: 10,
    },
    modeOption: {
      flex: 1,
      minHeight: 76,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 12,
      backgroundColor: colors.surface,
    },
    modeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    modeTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    modeTitleActive: { color: colors.primary },
    modeHint: {
      fontSize: 10,
      lineHeight: 14,
      color: colors.textMuted,
    },
    sourceOption: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      alignItems: 'center',
      backgroundColor: colors.surface,
      gap: 4,
    },
    sourceOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    sourceOptionEmoji: {
      fontSize: 22,
      marginBottom: 4,
    },
    sourceOptionText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    sourceOptionTextActive: {
      color: colors.primary,
    },
    sourceOptionHint: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
    },
    quickPickAvatar: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickPickAvatarText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
    nameFieldWrap: {
      position: 'relative',
      zIndex: 30,
    },
    suggestDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: 4,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 8,
      zIndex: 30,
      overflow: 'hidden',
    },
    suggestScroll: {
      maxHeight: 220,
    },
    suggestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestBody: {
      flex: 1,
    },
    suggestNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    suggestName: {
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    contributorTypeBadge: {
      borderRadius: 999,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    contributorTypeBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    suggestPhone: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 1,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 15,
      fontSize: 16,
      color: colors.textPrimary,
    },
    textArea: {
      minHeight: 88,
      paddingTop: 14,
    },
    currencyRow: {
      flexDirection: 'row',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    currencyPrefix: {
      paddingHorizontal: 16,
      paddingVertical: 15,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      backgroundColor: colors.background,
      justifyContent: 'center',
    },
    currencySymbol: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    currencyInput: {
      flex: 1,
      fontSize: 16,
      color: colors.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 15,
    },
    errorText: {
      fontSize: 12,
      color: colors.error,
      marginTop: 4,
    },
    providerRow: {
      gap: 10,
    },
    providerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.surface,
      gap: 10,
    },
    providerDot: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    providerDotText: {
      fontSize: 15,
      fontWeight: '800',
    },
    providerChipLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    providerCheck: {
      fontSize: 16,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 6,
    },
    detectedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    changeProviderText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    existingContributorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    existingContributorBody: {
      flex: 1,
    },
    existingContributorTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    existingContributorText: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    existingContributorAction: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    ambiguousContributorCard: {
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 12,
      backgroundColor: colors.accentLight,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    ambiguousContributorTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.accent,
    },
    ambiguousContributorText: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
    },
    autoAllocationCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.success,
      backgroundColor: colors.successLight,
      padding: 14,
      marginTop: -8,
      marginBottom: 22,
    },
    autoAllocationTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.success,
    },
    autoAllocationText: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    multiplePledgesCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.accentLight,
      padding: 14,
      marginTop: -8,
      marginBottom: 22,
    },
    sponsorshipAllocationCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
      padding: 14,
      marginTop: -8,
      marginBottom: 22,
    },
    sponsorshipAllocationTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.primary,
    },
    sponsorshipAllocationText: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    multiplePledgesTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.accent,
    },
    multiplePledgesText: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    pledgeChoiceList: {
      marginTop: 10,
      gap: 8,
    },
    pledgeChoice: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 11,
      backgroundColor: colors.surface,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    pledgeChoiceSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    pledgeChoiceBody: {
      flex: 1,
    },
    pledgeChoiceTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    pledgeChoiceTitleSelected: {
      color: colors.primary,
    },
    pledgeChoiceAmount: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textSecondary,
    },
    pledgeChoiceIndicator: {
      fontSize: 18,
      color: colors.textMuted,
    },
    pledgeChoiceIndicatorSelected: {
      color: colors.primary,
      fontWeight: '900',
    },
    charCount: {
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right',
      marginTop: 4,
    },
    auditCard: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      padding: 14,
      marginBottom: 24,
    },
    auditText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    primaryButton: {
      backgroundColor: colors.disabled,
      borderRadius: 28,
      paddingVertical: 17,
      alignItems: 'center',
    },
    buttonActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    primaryButtonText: {
      color: colors.disabledText,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    primaryButtonTextActive: {
      color: '#FFFFFF',
    },
  })
}
