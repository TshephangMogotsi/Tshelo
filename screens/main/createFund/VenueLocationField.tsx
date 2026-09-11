import { useState } from 'react'
import { Alert, Clipboard, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useTheme } from '../../../context/ThemeContext'
import { isMapsUrl, mapsSearchUrl, normalizeMapsUrl } from '../../../lib/maps'
import type { AppColors } from '../../../theme/themes'

type Props = {
  venue: string
  onVenueChange: (text: string) => void
  mapLink: string
  onMapLinkChange: (text: string) => void
}

export default function VenueLocationField({ venue, onVenueChange, mapLink, onMapLinkChange }: Props) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [showExactLocation, setShowExactLocation] = useState(() => mapLink.trim().length > 0)
  const trimmedMapLink = mapLink.trim()
  const hasMapLink = trimmedMapLink.length > 0
  const hasValidMapLink = hasMapLink && isMapsUrl(trimmedMapLink)
  const hasInvalidMapLink = hasMapLink && !hasValidMapLink
  const canSearchVenue = venue.trim().length >= 3
  const exactLocationLabel = hasInvalidMapLink
    ? 'Fix exact map location'
    : hasValidMapLink
      ? 'Exact map location added'
      : 'Add exact map location'
  const exactLocationColor = hasInvalidMapLink
    ? colors.error
    : hasValidMapLink
      ? colors.success
      : colors.primary

  async function openUrl(url: string) {
    try {
      if (!await Linking.canOpenURL(url)) {
        Alert.alert('Maps unavailable', 'No compatible maps app is available on this device.')
        return
      }
      await Linking.openURL(url)
    } catch {
      Alert.alert('Could not open Maps', 'Please try again or search for the venue directly in your maps app.')
    }
  }

  function handleOpenVenueSearch() {
    if (!canSearchVenue) return
    void openUrl(mapsSearchUrl(venue, Platform.OS === 'ios' ? 'ios' : 'android'))
  }

  async function handlePasteMapLink() {
    try {
      const clipboardValue = (await Clipboard.getString()).trim()
      if (!clipboardValue) {
        Alert.alert('Nothing to paste', 'Copy a place link from Google Maps, Apple Maps or Waze first.')
        return
      }

      const normalizedUrl = normalizeMapsUrl(clipboardValue)
      if (!normalizedUrl) {
        Alert.alert('Not a Maps link', 'Copy a Google Maps, Apple Maps or Waze place link and try again.')
        return
      }

      onMapLinkChange(normalizedUrl)
    } catch {
      Alert.alert('Could not paste', 'Allow clipboard access and try again.')
    }
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Venue or address</Text>
      <View style={styles.venueRow}>
        <TextInput
          style={styles.venueInput}
          placeholder="Cresta Lodge, Gaborone"
          placeholderTextColor={colors.textMuted}
          value={venue}
          onChangeText={onVenueChange}
          maxLength={120}
          returnKeyType="search"
          onSubmitEditing={handleOpenVenueSearch}
        />
        <TouchableOpacity
          style={[styles.mapButton, !canSearchVenue && styles.mapButtonDisabled]}
          activeOpacity={canSearchVenue ? 0.8 : 1}
          disabled={!canSearchVenue}
          onPress={handleOpenVenueSearch}
          accessibilityRole="button"
          accessibilityLabel="Find venue in Maps"
          accessibilityHint="Searches Maps using the venue or address entered"
          accessibilityState={{ disabled: !canSearchVenue }}
        >
          <Ionicons name="map-outline" size={21} color={canSearchVenue ? colors.primary : colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.venueHelp}>Use the map button to check that Maps finds the right place.</Text>

      <TouchableOpacity
        style={styles.exactLocationToggle}
        activeOpacity={0.78}
        onPress={() => setShowExactLocation(open => !open)}
        accessibilityRole="button"
        accessibilityLabel={exactLocationLabel}
        accessibilityState={{ expanded: showExactLocation }}
      >
        <Ionicons
          name={hasInvalidMapLink ? 'alert-circle' : hasValidMapLink ? 'checkmark-circle' : 'link-outline'}
          size={17}
          color={exactLocationColor}
        />
        <Text
          style={[
            styles.exactLocationText,
            hasValidMapLink && styles.exactLocationAdded,
            hasInvalidMapLink && styles.exactLocationInvalid,
          ]}
        >
          {exactLocationLabel}
        </Text>
        {!hasMapLink ? <Text style={styles.optional}>Optional</Text> : null}
        <Ionicons
          name={showExactLocation ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {showExactLocation ? (
        <View style={styles.exactLocationPanel}>
          <View style={[styles.mapLinkRow, hasInvalidMapLink && styles.inputError]}>
            <TextInput
              style={styles.mapLinkInput}
              placeholder="Paste a Maps place link"
              placeholderTextColor={colors.textMuted}
              value={mapLink}
              onChangeText={onMapLinkChange}
              maxLength={500}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <TouchableOpacity
              style={styles.pasteButton}
              activeOpacity={0.78}
              onPress={() => { void handlePasteMapLink() }}
              accessibilityRole="button"
              accessibilityLabel="Paste map link from clipboard"
            >
              <Text style={styles.pasteButtonText}>Paste</Text>
            </TouchableOpacity>
          </View>

          {hasInvalidMapLink ? (
            <Text style={styles.errorText}>Use a Google Maps, Apple Maps or Waze link.</Text>
          ) : hasValidMapLink ? (
            <View style={styles.linkStatusRow}>
              <View style={styles.linkStatusCopy}>
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Text style={styles.linkStatusText}>Location added</Text>
              </View>
              <TouchableOpacity
                onPress={() => { void openUrl(normalizeMapsUrl(trimmedMapLink)!) }}
                accessibilityRole="link"
                accessibilityLabel="Open exact map location to verify"
              >
                <Text style={styles.verifyText}>Open to verify</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.linkHelp}>In Maps, open the place, copy its share link, then tap Paste.</Text>
          )}
        </View>
      ) : null}
    </View>
  )
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    field: {
      marginBottom: 20,
    },
    label: {
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '500',
      color: colors.textMuted,
    },
    venueRow: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 16,
      paddingRight: 7,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
    },
    venueInput: {
      flex: 1,
      paddingVertical: 15,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    mapButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
    },
    mapButtonDisabled: {
      backgroundColor: colors.background,
    },
    venueHelp: {
      marginTop: 7,
      fontSize: 12,
      lineHeight: 17,
      color: colors.textMuted,
    },
    exactLocationToggle: {
      minHeight: 42,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: 7,
      paddingVertical: 8,
    },
    exactLocationText: {
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    exactLocationAdded: {
      color: colors.success,
    },
    exactLocationInvalid: {
      color: colors.error,
    },
    optional: {
      flex: 1,
      fontSize: 11,
      color: colors.textMuted,
    },
    exactLocationPanel: {
      marginTop: 4,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mapLinkRow: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 13,
      paddingRight: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    mapLinkInput: {
      flex: 1,
      paddingVertical: 12,
      paddingRight: 8,
      fontSize: 14,
      color: colors.textPrimary,
    },
    pasteButton: {
      minWidth: 58,
      minHeight: 38,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
    },
    pasteButtonText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.primary,
    },
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      marginTop: 7,
      fontSize: 11,
      lineHeight: 16,
      color: colors.error,
    },
    linkHelp: {
      marginTop: 7,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textMuted,
    },
    linkStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginTop: 8,
    },
    linkStatusCopy: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    linkStatusText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.success,
    },
    verifyText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.primary,
    },
  })
}
