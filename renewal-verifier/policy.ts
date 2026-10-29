export type RenewalEvidence = {
  evidenceVersion: '1.0' | '1.1'
  subscriptionId: string
  merchant: string
  currency: string
  previousAmountMinor: number
  proposedAmountMinor: number
  renewalAt: string
  notice: {
    status: 'delivered' | 'bounced' | 'missing'
    deliveredAt: string | null
    providerReceiptId: string | null
    providerAcceptedAt?: string
    messageId?: string | null
    observedProviderEvent?: string
    observedAt?: string
  }
  source?: {
    kind: 'resend-provider-record'
    verifiedDelivery: boolean
    recipientSha256: string
    disclosure: string
  }
  customer: {
    cancelledAt: string | null
    approvedAmountMinor: number | null
    approvedAt: string | null
  }
}

export type RenewalDecision = {
  decision: 'EXECUTE' | 'BLOCK'
  code:
    | 'RENEWAL_COMPLIANT'
    | 'CUSTOMER_CANCELLED'
    | 'NOTICE_NOT_DELIVERED'
    | 'NOTICE_TOO_LATE'
    | 'FRESH_APPROVAL_REQUIRED'
  explanation: string
  noticeDays: number | null
  priceChangePercent: number
}

const REQUIRED_NOTICE_DAYS = 7

const daysBetween = (earlier: string, later: string): number =>
  (Date.parse(later) - Date.parse(earlier)) / 86_400_000

export const evaluateRenewal = (evidence: RenewalEvidence): RenewalDecision => {
  const priceChangePercent =
    evidence.previousAmountMinor === 0
      ? 0
      : ((evidence.proposedAmountMinor - evidence.previousAmountMinor) /
          evidence.previousAmountMinor) *
        100

  if (evidence.customer.cancelledAt) {
    return {
      decision: 'BLOCK',
      code: 'CUSTOMER_CANCELLED',
      explanation: 'The customer cancelled before renewal.',
      noticeDays: null,
      priceChangePercent,
    }
  }

  if (evidence.notice.status !== 'delivered' || !evidence.notice.deliveredAt) {
    return {
      decision: 'BLOCK',
      code: 'NOTICE_NOT_DELIVERED',
      explanation: 'Delivery of the renewal notice is not proven.',
      noticeDays: null,
      priceChangePercent,
    }
  }

  const noticeDays = daysBetween(evidence.notice.deliveredAt, evidence.renewalAt)
  if (noticeDays < REQUIRED_NOTICE_DAYS) {
    return {
      decision: 'BLOCK',
      code: 'NOTICE_TOO_LATE',
      explanation: `The notice arrived ${noticeDays.toFixed(1)} days before renewal; policy requires ${REQUIRED_NOTICE_DAYS}.`,
      noticeDays,
      priceChangePercent,
    }
  }

  const priceChanged = evidence.proposedAmountMinor !== evidence.previousAmountMinor
  const approvalCoversChange =
    evidence.customer.approvedAmountMinor === evidence.proposedAmountMinor &&
    evidence.customer.approvedAt !== null &&
    Date.parse(evidence.customer.approvedAt) >= Date.parse(evidence.notice.deliveredAt)

  if (priceChanged && !approvalCoversChange) {
    return {
      decision: 'BLOCK',
      code: 'FRESH_APPROVAL_REQUIRED',
      explanation: 'The price changed without fresh customer approval for the proposed amount.',
      noticeDays,
      priceChangePercent,
    }
  }

  return {
    decision: 'EXECUTE',
    code: 'RENEWAL_COMPLIANT',
    explanation: 'Notice, timing, cancellation, and price-consent checks passed.',
    noticeDays,
    priceChangePercent,
  }
}

export const assertEvidence = (value: unknown): RenewalEvidence => {
  if (!value || typeof value !== 'object') throw new Error('Evidence must be an object')
  const evidence = value as Partial<RenewalEvidence>
  if (evidence.evidenceVersion !== '1.0' && evidence.evidenceVersion !== '1.1') {
    throw new Error('Unsupported evidence version')
  }
  if (!evidence.subscriptionId || !evidence.merchant || !evidence.renewalAt) {
    throw new Error('Evidence is missing required identifiers')
  }
  if (!evidence.notice || !evidence.customer) throw new Error('Evidence is incomplete')
  if (!Number.isInteger(evidence.previousAmountMinor) || !Number.isInteger(evidence.proposedAmountMinor)) {
    throw new Error('Amounts must be integer minor units')
  }
  if (!Number.isFinite(Date.parse(evidence.renewalAt))) throw new Error('Renewal date is invalid')

  if (evidence.evidenceVersion === '1.1') {
    const source = evidence.source
    const notice = evidence.notice

    if (
      !source ||
      source.kind !== 'resend-provider-record' ||
      typeof source.verifiedDelivery !== 'boolean' ||
      !/^[a-f0-9]{64}$/i.test(source.recipientSha256 || '')
    ) {
      throw new Error('Provider evidence source is invalid')
    }

    if (
      !notice.providerReceiptId ||
      !notice.providerAcceptedAt ||
      !notice.observedAt ||
      !Number.isFinite(Date.parse(notice.providerAcceptedAt)) ||
      !Number.isFinite(Date.parse(notice.observedAt))
    ) {
      throw new Error('Provider evidence timestamps are invalid')
    }

    const deliveredEvents = ['delivered', 'opened', 'clicked']
    const deliveryClaimed =
      notice.status === 'delivered' && notice.deliveredAt !== null

    if (
      deliveryClaimed !== source.verifiedDelivery ||
      (deliveryClaimed &&
        !deliveredEvents.includes(notice.observedProviderEvent || ''))
    ) {
      throw new Error('Provider delivery claim is inconsistent')
    }
  }

  return evidence as RenewalEvidence
}
