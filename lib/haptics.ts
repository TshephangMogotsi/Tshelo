import * as Haptics from 'expo-haptics'

// Fire-and-forget wrappers — feedback should never block or crash a flow
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}

export function hapticError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
}

export function hapticTap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}
