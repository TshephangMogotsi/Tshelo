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
  JoinEvent:           { code?: string } | undefined
  FundDetail:          { fundId: string; tab?: 'contributions' | 'sponsorships' | 'expenses' | 'members' }
  EventDetail:         {
    eventId: string
    tab?: 'guests' | 'announcements' | 'budget'
    workspace?: 'event' | 'fund'
    fundTab?: 'contributions' | 'sponsorships' | 'expenses' | 'members'
  }
  GuestList:           { eventId: string }
  EventBudget:         { eventId: string }
  RecordContribution:  {
    fundId: string
    fundTitle: string
    currencyCode: string
    initialMode?: 'pledge' | 'received'
    sponsorshipItemId?: string
    sponsorUserId?: string
  }
  AssignContribution:  { detected: import('../lib/smsWatcher').DetectedSms; notificationId?: string }
  RecordExpense:       {
    fundId: string
    fundTitle: string
    currencyCode: string
    sponsorshipItemId?: string
    sponsorshipItemTitle?: string
    sponsorshipTargetAmount?: number
    sponsorUserId?: string
  }
  TokenPurchase:       undefined
  Support:             undefined
  Settings:            undefined
  Notifications:       undefined
  MemberDetails:       {
    fundId: string
    fundTitle: string
    currencyCode: string
    memberId: string
    memberUserId: string
    memberName: string
    memberPhone: string
    canAward: boolean
  }
  AwardRichAuntie:     {
    fundId: string
    fundTitle: string
    currencyCode: string
    memberUserId: string
    memberName: string
  }
  RichAuntieCelebration: { awardId: string; recipientView?: boolean }
  RichAuntieStatus:    undefined
  Rewards:             undefined
  FundCreated:         { fundName: string; category: string; emoji: string; goalBWP?: string; currencyCode?: string; currencySymbol?: string; targetDate?: string; shareCode?: string; fundId?: string }
}
