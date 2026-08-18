import type {
  ApiResponse,
  IsoDateTime,
  JsonValue,
  ListRequest,
  PaginatedResponse,
  Uuid,
} from './common'

export type Notification = {
  id: Uuid
  user_id: Uuid
  fund_id: Uuid | null
  type: string
  title: string
  body: string
  data: Record<string, JsonValue> | null
  is_read: boolean
  read_at: IsoDateTime | null
  delivered_at: IsoDateTime | null
  opened_at: IsoDateTime | null
  clicked_at: IsoDateTime | null
  response_action: string | null
  created_at: IsoDateTime
}

export type NotificationFilters = {
  type?: string | string[]
  unread_only?: boolean
}

export type NotificationSortField = 'created_at'
export type ListNotificationsRequest = ListRequest<NotificationFilters, NotificationSortField>

export type GetNotificationRequest = {
  notification_id: Uuid
}

export type MarkNotificationsReadRequest = {
  notification_ids: Uuid[]
}

export type MarkNotificationsReadResult = {
  updated_ids: Uuid[]
}

export type ListNotificationsResponse = PaginatedResponse<Notification>
export type GetNotificationResponse = ApiResponse<Notification>
export type MarkNotificationsReadResponse = ApiResponse<MarkNotificationsReadResult>
