import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '../../../lib/supabase'

export type ParsedReceiptItem = {
  name:     string
  amount:   number
  category: string | null
}

export type ParsedReceipt = {
  vendor: string | null
  date:   string | null
  total:  number | null
  items:  ParsedReceiptItem[]
}

export async function pickFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow photo access to attach a receipt.')
    return null
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  })
  return !result.canceled && result.assets.length > 0 ? result.assets[0].uri : null
}

export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Allow camera access to photograph a receipt.')
    return null
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
  return !result.canceled && result.assets.length > 0 ? result.assets[0].uri : null
}

// Downscales the photo and sends it to the parse-receipt edge function.
// Returns null on any failure — the review screen falls back to manual entry.
export async function parseReceipt(uri: string, fundId: string): Promise<ParsedReceipt | null> {
  try {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    )
    if (!resized.base64) return null

    const { data, error } = await supabase.functions.invoke('parse-receipt', {
      body: { fundId, image: resized.base64, mediaType: 'image/jpeg' },
    })

    if (error || !data || data.error || data.is_receipt === false) return null
    return {
      vendor: data.vendor ?? null,
      date:   data.date ?? null,
      total:  data.total ?? null,
      items:  Array.isArray(data.items) ? data.items : [],
    }
  } catch {
    return null
  }
}

export async function uploadReceipt(fundId: string, userId: string, uri: string): Promise<string | null> {
  try {
    // Re-encode to a bounded JPEG before upload. Besides normalising HEIC/PNG
    // inputs, this avoids retaining camera metadata in the stored document.
    const normalised = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1800 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    )
    const response = await fetch(normalised.uri)
    const blob     = await response.blob()
    const path     = `${fundId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    const { error } = await supabase.storage
      .from('receipts')
      .upload(path, blob, { contentType: 'image/jpeg' })

    if (error) return null
    // Store the private object path. Views that display the document should
    // request a short-lived signed URL after their membership check succeeds.
    return path
  } catch {
    return null
  }
}
