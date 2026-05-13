export type AuthStackParamList = {
  Welcome: undefined
  Login: undefined
  OTP: { phone: string; mode: 'login' | 'register' | 'recover' }
  Register: { phone: string }
  Recover: undefined
}

export type MainStackParamList = {
  Home: undefined
  CreateFund: undefined
  JoinFund: undefined
  FundDetail: { fundId: string }
  RecordContribution: { fundId: string; fundTitle: string }
  RecordExpense: { fundId: string; fundTitle: string }
  TokenPurchase: undefined
}
