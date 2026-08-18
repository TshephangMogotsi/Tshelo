import type { IsoDate, IsoDateTime, MoneyAmount, Uuid } from './common'

export const RECEIPT_MEDIA_TYPES = ['image/jpeg', 'image/png'] as const
export type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number]

export type CreateReceiptUploadSessionRequest = {
  fund_id: Uuid
  content_type: ReceiptMediaType
  size_bytes: number
}

export type ReceiptUploadSession = {
  object_path: string
  upload_url: string
  content_type: ReceiptMediaType
  expires_at: IsoDateTime
}

export type ParseReceiptRequest = {
  fund_id: Uuid
  object_path: string
}

export type ParsedReceiptItem = {
  name: string
  amount: MoneyAmount
  category: string | null
}

export type ParsedReceipt = {
  object_path: string
  is_receipt: boolean
  vendor: string | null
  date: IsoDate | null
  total: MoneyAmount | null
  items: ParsedReceiptItem[]
}
