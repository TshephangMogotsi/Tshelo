import { INVITATION_WEB_ORIGIN } from '@shared/invitations'

export const appLinking = {
  prefixes: [INVITATION_WEB_ORIGIN, 'tshelo://', 'exp+tshelo://'],
  config: {
    screens: {
      JoinFund: 'invite/fund/:code',
      JoinEvent: 'invite/event/:code',
    },
  },
}
