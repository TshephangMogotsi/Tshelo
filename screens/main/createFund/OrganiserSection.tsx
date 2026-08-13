import { ReactNode } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../context/ThemeContext'
import type { AppColors } from '../../../theme/themes'
import { BRAND_ACCENT, BRAND_LAVENDER, BRAND_PURPLE, PickedOrganiser } from './constants'

type Props = {
  subtitle: string
  count: number
  creatorInitials: string
  creatorName: string
  search: string
  onSearchChange: (text: string) => void
  connectionResults: PickedOrganiser[]
  isSearchingConnections: boolean
  onAddConnection: (person: PickedOrganiser) => void
  pickedOrganisers: PickedOrganiser[]
  onAddFromContacts: () => void
  onRemoveOrganiser: (id: string) => void
  children?: ReactNode
}

export default function OrganiserSection({
  subtitle,
  count,
  creatorInitials,
  creatorName,
  search,
  onSearchChange,
  connectionResults,
  isSearchingConnections,
  onAddConnection,
  pickedOrganisers,
  onAddFromContacts,
  onRemoveOrganiser,
  children,
}: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)

  return (
    <>
      <Text style={styles.organisersTitle}>Add organisers</Text>
      <Text style={styles.organisersSubtitle}>{subtitle}</Text>

      <TouchableOpacity
        style={styles.addContactsButton}
        activeOpacity={0.84}
        onPress={onAddFromContacts}
      >
        <View style={styles.addContactsIcon}>
          <Ionicons name="people-outline" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.addContactsBody}>
          <Text style={styles.addContactsTitle}>Add people from contacts</Text>
          <Text style={styles.addContactsSubtitle}>Choose organisers from your phone book</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.previousConnectionsLabel}>Search previous connections</Text>
      <View style={styles.organiserSearchBox}>
        <Text style={styles.organiserSearchIcon}>🔍</Text>
        <TextInput
          style={styles.organiserSearchInput}
          placeholder="Search connected users"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={onSearchChange}
          returnKeyType="search"
        />
      </View>

      {search.trim().length >= 2 && (
        <View style={styles.searchResults}>
          {isSearchingConnections ? (
            <Text style={styles.searchMessage}>Searching your connections…</Text>
          ) : connectionResults.length === 0 ? (
            <Text style={styles.searchMessage}>No previous connections found.</Text>
          ) : connectionResults.map(person => (
            <TouchableOpacity
              key={person.id}
              style={styles.searchResultRow}
              onPress={() => onAddConnection(person)}
              activeOpacity={0.8}
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.organiserAvatarText}>{person.initials}</Text>
              </View>
              <View style={styles.organiserBody}>
                <Text style={styles.organiserName}>{person.name}</Text>
                <Text style={styles.organiserPhone}>{person.phone}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.organisersSectionTitle}>ORGANISERS ({count})</Text>

      <View style={[styles.organiserCard, styles.creatorOrganiserCard]}>
        <View style={styles.creatorAvatar}>
          <Text style={styles.organiserAvatarText}>{creatorInitials}</Text>
        </View>
        <View style={styles.organiserBody}>
          <Text style={styles.organiserName} numberOfLines={1}>{creatorName}</Text>
          <Text style={styles.creatorMeta} numberOfLines={1}>👑 You (creator)</Text>
        </View>
      </View>

      {pickedOrganisers.map(person => (
        <View key={person.id} style={styles.organiserCard}>
          <View style={styles.contactAvatar}>
            <Text style={styles.organiserAvatarText}>{person.initials}</Text>
          </View>
          <View style={styles.organiserBody}>
            <Text style={styles.organiserName} numberOfLines={1}>{person.name}</Text>
            {person.phone ? (
              <Text style={styles.organiserPhone} numberOfLines={1}>{person.phone}</Text>
            ) : (
              <Text style={styles.organiserPhone} numberOfLines={1}>From contacts</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.organiserRemove}
            activeOpacity={0.75}
            onPress={() => onRemoveOrganiser(person.id)}
          >
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}

      {children}

      <Text style={styles.organisersNote}>You can add more organisers later</Text>
    </>
  )
}

export function makeOrganiserStyles(colors: AppColors) {
  return makeStyles(colors)
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    organisersTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 10,
    },
    organisersSubtitle: {
      fontSize: 16,
      lineHeight: 23,
      color: colors.textMuted,
      marginBottom: 22,
    },
    addContactsButton: {
      minHeight: 74,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 12,
      marginBottom: 18,
    },
    addContactsIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
    },
    addContactsBody: {
      flex: 1,
    },
    addContactsTitle: {
      fontSize: 16,
      lineHeight: 21,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    addContactsSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textMuted,
    },
    previousConnectionsLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    organiserSearchBox: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 18,
      gap: 10,
      marginBottom: 22,
    },
    organiserSearchIcon: {
      fontSize: 20,
    },
    organiserSearchInput: {
      flex: 1,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
      paddingVertical: 12,
    },
    organisersSectionTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '900',
      color: colors.textMuted,
      marginBottom: 12,
    },
    searchResults: {
      marginTop: -12,
      marginBottom: 20,
      gap: 8,
    },
    searchMessage: {
      fontSize: 13,
      color: colors.textMuted,
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    searchResultRow: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    organiserCard: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
      marginBottom: 10,
    },
    creatorOrganiserCard: {
      backgroundColor: BRAND_LAVENDER,
      borderWidth: 2,
      borderColor: '#D8B4FE',
    },
    creatorAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_PURPLE,
    },
    blueAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2454D9',
    },
    orangeAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: BRAND_ACCENT,
    },
    contactAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0F9F8D',
    },
    organiserAvatarText: {
      fontSize: 16,
      fontWeight: '900',
      color: '#FFFFFF',
    },
    organiserBody: {
      flex: 1,
    },
    organiserName: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '900',
      color: colors.textPrimary,
      marginBottom: 2,
    },
    creatorMeta: {
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '700',
      color: BRAND_PURPLE,
    },
    organiserPhone: {
      fontSize: 13,
      lineHeight: 17,
      color: colors.textMuted,
    },
    organiserRemove: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    organisersNote: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
      marginBottom: 22,
    },
  })
}
