// Botswana banks with universal branch codes used for local EFT clearing.
// ⚠️  Verify branch codes with each bank before going live —
//     codes can change when banks are acquired or re-platform.

export type Bank = {
  name:       string
  shortName:  string
  branchCode: string
}

export const BOTSWANA_BANKS: Bank[] = [
  { name: 'FNB Botswana',              shortName: 'FNB',          branchCode: '281667' },
  { name: 'ABSA Botswana',             shortName: 'ABSA',         branchCode: '430000' },
  { name: 'Stanbic Bank Botswana',     shortName: 'Stanbic',      branchCode: '060144' },
  { name: 'BancABC Botswana',          shortName: 'BancABC',      branchCode: '490000' },
  { name: 'First Capital Bank',        shortName: 'First Capital', branchCode: '399000' },
  { name: 'Bank Gaborone',             shortName: 'Bank Gaborone', branchCode: '100723' },
  { name: 'Letshego Bank Botswana',    shortName: 'Letshego',     branchCode: '200001' },
  { name: 'Access Bank Botswana',      shortName: 'Access Bank',  branchCode: '000009' },
  { name: 'Bank of Baroda Botswana',   shortName: 'Bank of Baroda', branchCode: '000010' },
]
