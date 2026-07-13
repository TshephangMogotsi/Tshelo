import { requireOptionalNativeModule, NativeModule, EventSubscription } from 'expo-modules-core'

export type IncomingSms = {
  sender: string
  body:   string
}

type SmsListenerEvents = {
  onSmsReceived: (sms: IncomingSms) => void
}

declare class SmsListenerModule extends NativeModule<SmsListenerEvents> {}

// Optional so importing this on iOS (no native counterpart) doesn't throw
const SmsListener = requireOptionalNativeModule<SmsListenerModule>('SmsListener')

export function addSmsListener(listener: (sms: IncomingSms) => void): EventSubscription | null {
  return SmsListener?.addListener('onSmsReceived', listener) ?? null
}
