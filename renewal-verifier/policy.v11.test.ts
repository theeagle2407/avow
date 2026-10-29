import { describe, expect, test } from 'bun:test'
import { assertEvidence, evaluateRenewal } from './policy'

const liveEvidence = {
  evidenceVersion: '1.1',
  subscriptionId: 'sub_demo_price_increase',
  merchant: 'Northstar Cloud',
  currency: 'USD',
  previousAmountMinor: 1900,
  proposedAmountMinor: 2900,
  renewalAt: '2026-11-20T12:00:00.000Z',
  notice: {
    status: 'delivered',
    deliveredAt: '2026-10-29T15:06:46.849Z',
    providerAcceptedAt: '2026-10-29T15:06:07.246Z',
    providerReceiptId: '01a18832-6751-7482-b43c-71087109fe5e',
    messageId: '<provider-message@example.test>',
    observedProviderEvent: 'delivered',
    observedAt: '2026-10-29T15:06:46.849Z',
  },
  customer: {
    cancelledAt: null,
    approvedAmountMinor: null,
    approvedAt: null,
  },
  source: {
    kind: 'resend-provider-record',
    verifiedDelivery: true,
    recipientSha256:
      '39f29d7165f37bd0e772581dbae6f0e5bca6b62d66d6104892744fc83b59f162',
    disclosure:
      'Resend reports delivery. The observation timestamp is conservative.',
  },
} as const

describe('provider-backed evidence v1.1', () => {
  test('accepts a consistent delivered provider record', () => {
    const evidence = assertEvidence(liveEvidence)
    expect(evaluateRenewal(evidence).code).toBe('FRESH_APPROVAL_REQUIRED')
  })

  test('rejects a delivered claim without provider verification', () => {
    expect(() =>
      assertEvidence({
        ...liveEvidence,
        source: {
          ...liveEvidence.source,
          verifiedDelivery: false,
        },
      }),
    ).toThrow('Provider delivery claim is inconsistent')
  })

  test('rejects a malformed recipient commitment', () => {
    expect(() =>
      assertEvidence({
        ...liveEvidence,
        source: {
          ...liveEvidence.source,
          recipientSha256: 'not-a-hash',
        },
      }),
    ).toThrow('Provider evidence source is invalid')
  })
})
