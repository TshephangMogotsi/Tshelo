export type BankDetails = {
  bankName:      string
  branchCode:    string
  accountNumber: string
  accountType:   'savings' | 'current'
}

export type RegistrationData = {
  name:     string
  provider: 'orange_money' | 'myzaka' | 'smega'
  bank:     BankDetails
}

export type AuthStackParamList = {
  Welcome: undefined
  Login: undefined
  Register: undefined
  OTP: { phone: string; mode: 'login' | 'register'; registration?: RegistrationData }
  ProfileSetup: undefined
  RegistrationSuccess: undefined
  Support: undefined
}

export type MainTabParamList = {
  Home: undefined
  Settings: undefined
}

export type MainStackParamList = {
  Tabs: undefined
  CreateFund: undefined
  JoinFund: undefined
  FundDetail: { fundId: string }
  RecordContribution: { fundId: string; fundTitle: string }
  RecordExpense: { fundId: string; fundTitle: string }
  TokenPurchase: undefined
  Support: undefined
}
