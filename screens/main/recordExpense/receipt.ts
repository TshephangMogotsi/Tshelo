import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../../lib/supabase'

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

export async function uploadReceipt(fundId: string, userId: string, uri: string): Promise<string | null> {
  try {
    const response = await fetch(uri)
    const blob     = await response.blob()
    const ext      = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path     = `${fundId}/${userId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('receipts')
      .upload(path, blob, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` })

    if (error) return null

    const { data } = supabase.storage.from('receipts').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return null
  }
}
