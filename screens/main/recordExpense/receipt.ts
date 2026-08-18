import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../../../lib/api'

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
  objectPath: string
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

async function uploadNormalisedReceipt(fundId: string, uri: string): Promise<string> {
  const source = await fetch(uri)
  if (!source.ok) throw new Error('The receipt image could not be read.')
  const bytes = await source.arrayBuffer()
  const session = await api.receipts.createUploadSession({
    fund_id: fundId,
    content_type: 'image/jpeg',
    size_bytes: bytes.byteLength,
  })
  const upload = await fetch(session.upload_url, {
    method: 'PUT',
    headers: {
      'cache-control': 'max-age=3600',
      'content-type': session.content_type,
      'x-upsert': 'false',
    },
    body: bytes,
  })
  if (!upload.ok) throw new Error('The receipt image could not be uploaded.')
  return session.object_path
}

// Downscales, uploads through an API-authorised session, then asks the API to parse it.
// Returns null on any failure — the review screen falls back to manual entry.
export async function parseReceipt(uri: string, fundId: string): Promise<ParsedReceipt | null> {
  try {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    )
    const objectPath = await uploadNormalisedReceipt(fundId, resized.uri)
    const data = await api.receipts.parse({ fund_id: fundId, object_path: objectPath })
    if (!data.is_receipt) return null
    return {
      vendor: data.vendor ?? null,
      date:   data.date ?? null,
      total:  data.total === null ? null : Number(data.total),
      items:  data.items.map(item => ({ ...item, amount: Number(item.amount) })),
      objectPath,
    }
  } catch {
    return null
  }
}

export async function uploadReceipt(fundId: string, uri: string): Promise<string | null> {
  try {
    // Re-encode to a bounded JPEG before upload. Besides normalising HEIC/PNG
    // inputs, this avoids retaining camera metadata in the stored document.
    const normalised = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1800 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    )
    return await uploadNormalisedReceipt(fundId, normalised.uri)
  } catch {
    return null
  }
}
