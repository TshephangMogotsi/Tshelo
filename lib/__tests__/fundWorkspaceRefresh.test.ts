import {
  notifyFundWorkspaceChanged,
  subscribeToFundWorkspaceChanges,
} from '../fundWorkspaceRefresh'

describe('fund workspace refresh notifications', () => {
  it('notifies only listeners for the changed fund and cleans up subscriptions', () => {
    const firstFundListener = jest.fn()
    const secondFundListener = jest.fn()
    const unsubscribe = subscribeToFundWorkspaceChanges('fund-1', firstFundListener)
    subscribeToFundWorkspaceChanges('fund-2', secondFundListener)

    notifyFundWorkspaceChanged('fund-1')

    expect(firstFundListener).toHaveBeenCalledTimes(1)
    expect(secondFundListener).not.toHaveBeenCalled()

    unsubscribe()
    notifyFundWorkspaceChanged('fund-1')

    expect(firstFundListener).toHaveBeenCalledTimes(1)
  })
})
