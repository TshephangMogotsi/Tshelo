export type BankDetails = {
  bankName:      string
  branchCode:    string
  accountNumber: string
  accountType:   'savings' | 'current'
}

export type MobileMoneyNumber = {
  id:       string
  phone:    string
  provider: 'orange_money' | 'myzaka' | 'smega' | 'unknown'
}

export type BankAccount = {
  id:            string
  bankName:      string
  branchCode:    string
  accountNumber: string
}

export type RegistrationData = {
  name:     string
  provider: 'orange_money' | 'myzaka' | 'smega'
  bank:     BankDetails
}

export type AuthStackParamList = {
  Welcome:       undefined
  CountrySelect: undefined
  Login:         undefined
  Register:      { countryCode?: string; countryName?: string; currency?: string; flag?: string; dialCode?: string } | undefined
  OTP: {
    phone: string
    mode: 'login' | 'register' | 'mobile_money'
    registration?: RegistrationData
    mobileMoneyReturn?: {
      name?: string
      registeredPhone?: string
      bankName: string
      branchCode: string
      accountNumber: string
      bankAccounts: BankAccount[]
      mobileMoneyNumbers: MobileMoneyNumber[]
      pendingNumber: MobileMoneyNumber
    }
  }
  BankDetails:  {
    name?: string
    registeredPhone?: string
    bankName?: string
    branchCode?: string
    accountNumber?: string
    bankAccounts?: BankAccount[]
    mobileMoneyNumbers?: MobileMoneyNumber[]
  }
  ReceiveMoney: {
    name?: string
    registeredPhone?: string
    bankName?: string
    accountNumber?: string
    bankAccounts?: BankAccount[]
    mobileMoneyNumbers: MobileMoneyNumber[]
  }
  ProfileSetup: undefined
  RegistrationSuccess: undefined
  Support: undefined
}

export type MainTabParamList = {
  Home:     undefined
  Tokens:   undefined
  Activity: undefined
  Reports:  undefined
  Profile:  undefined
}

export type MainStackParamList = {
  Tabs:                undefined
  CreateFund:          { isFirst?: boolean } | undefined
  JoinFund:            { code?: string } | undefined
  FundDetail:          { fundId: string; tab?: 'contributions' | 'expenses' | 'members' }
  EventDetail:         { eventId: string }
  GuestList:           { eventId: string }
  EventBudget:         { eventId: string }
  RecordContribution:  { fundId: string; fundTitle: string; currencyCode: string }
  AssignContribution:  { detected: import('../lib/smsWatcher').DetectedSms }
  RecordExpense:       { fundId: string; fundTitle: string; currencyCode: string }
  TokenPurchase:       undefined
  Support:             undefined
  Settings:            undefined
  Notifications:       undefined
  FundCreated:         { fundName: string; category: string; emoji: string; goalBWP?: string; currencyCode?: string; currencySymbol?: string; targetDate?: string; shareCode?: string; fundId?: string }
}
