import { supabase } from './supabase'
import { nationalPhoneDigits } from './phoneNumbers'

function canonicalPhone(phone: string) {
  const digits = nationalPhoneDigits(phone)
  return digits ? `+${digits}` : ''
}

async function currentAccount(expectedId: string) {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user || data.user.id !== expectedId) throw new Error('Please sign in again before changing your number.')
  if (data.user.app_metadata?.google_play_reviewer === true) throw new Error('Number changes are unavailable for the review account.')
  if (!canonicalPhone(data.user.phone ?? '')) throw new Error('Your current sign-in number is unavailable. Contact support.')
  return data.user
}

export async function sendCurrentNumberCode(userId: string) {
  const user = await currentAccount(userId)
  const phone = canonicalPhone(user.phone ?? '')
  const { error } = await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } })
  if (error) throw error
  return phone
}

export async function confirmCurrentNumber(userId: string, phone: string, token: string) {
  if (!/^\d{6,10}$/.test(token)) throw new Error('Enter the complete code from your SMS.')
  const before = await currentAccount(userId)
  if (canonicalPhone(before.phone ?? '') !== canonicalPhone(phone)) throw new Error('Your current number changed. Start again.')
  const { data, error } = await supabase.auth.verifyOtp({ phone: canonicalPhone(phone), token, type: 'sms' })
  if (error) throw error
  if (data.user?.id !== userId || canonicalPhone(data.user.phone ?? '') !== canonicalPhone(phone) || !data.user.phone_confirmed_at) {
    throw new Error('Could not confirm ownership of your current number. Start again.')
  }
}

export async function requestPhoneChange(userId: string, phone: string) {
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error('Enter a valid international phone number.')
  const user = await currentAccount(userId)
  if (nationalPhoneDigits(user.phone ?? '') === nationalPhoneDigits(phone)) {
    throw new Error('Enter a different phone number.')
  }
  const { data, error } = await supabase.auth.updateUser({ phone })
  if (error) throw error
  if (data.user?.id !== userId || nationalPhoneDigits(data.user.new_phone ?? '') !== nationalPhoneDigits(phone)) {
    throw new Error('Could not start the number change. Please try again.')
  }
}

export async function confirmPhoneChange(userId: string, phone: string, token: string) {
  if (!/^\d{6,10}$/.test(token)) throw new Error('Enter the complete code from your SMS.')
  const pending = await currentAccount(userId)
  if (nationalPhoneDigits(pending.new_phone ?? '') !== nationalPhoneDigits(phone)) {
    throw new Error('This number change is no longer pending. Request a new code.')
  }
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' })
  if (error) throw error
  if (data.user?.id !== userId || nationalPhoneDigits(data.user.phone ?? '') !== nationalPhoneDigits(phone) || !data.user.phone_confirmed_at) {
    throw new Error('Could not confirm the number change. Check your account before trying again.')
  }
}

export function phoneChangeError(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  if (code === 'phone_exists' || code === 'user_already_exists') return 'This number is already linked to another account. Use a different number.'
  if (code === 'otp_expired') return 'The code is invalid or has expired. Check it or request a new code.'
  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit') return 'Please wait before requesting another code.'
  if (error instanceof Error && !('status' in error)) return error.message
  return 'Could not complete the number change. Please try again.'
}
