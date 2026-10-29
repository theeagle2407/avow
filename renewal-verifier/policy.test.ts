import { describe, expect, test } from 'bun:test'
import { evaluateRenewal, type RenewalEvidence } from './policy'

const base: RenewalEvidence = {
  evidenceVersion: '1.0',
  subscriptionId: 'sub_demo_001',
  merchant: 'Northstar Cloud',
  currency: 'USD',
  previousAmountMinor: 1900,
  proposedAmountMinor: 1900,
  renewalAt: '2026-11-20T12:00:00.000Z',
  notice: {
    status: 'delivered',
    deliveredAt: '2026-11-10T12:00:00.000Z',
    providerReceiptId: 'delivery_demo_001',
  },
  customer: { cancelledAt: null, approvedAmountMinor: null, approvedAt: null },
}

describe('UK-SUB-2026.1 renewal decisions', () => {
  test('executes an unchanged renewal with timely delivered notice', () => {
    expect(evaluateRenewal(base).decision).toBe('EXECUTE')
  })

  test('blocks a silent price increase', () => {
    const result = evaluateRenewal({ ...base, proposedAmountMinor: 2900 })
    expect(result.code).toBe('FRESH_APPROVAL_REQUIRED')
  })

  test('allows a price increase after fresh approval of the exact amount', () => {
    const result = evaluateRenewal({
      ...base,
      proposedAmountMinor: 2900,
      customer: {
        cancelledAt: null,
        approvedAmountMinor: 2900,
        approvedAt: '2026-11-11T12:00:00.000Z',
      },
    })
    expect(result.code).toBe('RENEWAL_COMPLIANT')
  })

  test('blocks after cancellation', () => {
    const result = evaluateRenewal({
      ...base,
      customer: { ...base.customer, cancelledAt: '2026-11-12T12:00:00.000Z' },
    })
    expect(result.code).toBe('CUSTOMER_CANCELLED')
  })
})
