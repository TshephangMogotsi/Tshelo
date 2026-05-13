export type AuthStackParamList = {
  Welcome: undefined
  Login: undefined
  OTP: { phone: string; mode: 'login' | 'register' | 'recover' }
  Register: { phone: string }
  Recover: undefined
}
