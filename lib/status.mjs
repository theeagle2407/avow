export const PUBLIC_PROOF = Object.freeze({
  network: 'Sepolia',
  contract: '0x904f247794a68f83ec90f441718b88f67d99e98c',
  transaction: '0x2b11599ad5c75d5732dba55eeb69dd9c60691e12dc54d85ceba754ee804b349b',
  subscriptionId: 'sub_demo_price_increase',
  evidenceHash: '0xfe4f340c7a3a2c70a4d714e4a529d96714bf88b1b03d49ea93ab1d5534859e86',
  decisionCode: 'FRESH_APPROVAL_REQUIRED',
})

export function assembleStatus({ evidence, renewal, decision, decisionCount, receipt }) {
  if (!evidence?.source?.verifiedDelivery) throw new Error('Delivery evidence is not verified')
  const evidenceMatches = decision.evidenceHash.toLowerCase() === PUBLIC_PROOF.evidenceHash
  const codeMatches = decision.codeMatches === true
  const transactionSucceeded = receipt.status === 'success'
  const canonical = evidenceMatches && codeMatches && transactionSucceeded && decision.value === 2
  return {
    schema: 'avow.status.v1',
    checkedAt: new Date().toISOString(),
    canonical,
    policy: 'UK-SUB-2026.1',
    decision: canonical ? 'BLOCK' : 'UNVERIFIED',
    code: canonical ? PUBLIC_PROOF.decisionCode : 'PROOF_MISMATCH',
    explanation: canonical
      ? 'The price changed without fresh customer approval for the proposed amount.'
      : 'The public proof did not match the canonical Avow receipt.',
    renewal: {
      merchant: evidence.merchant,
      currency: evidence.currency,
      previousAmountMinor: Number(renewal.previousAmountMinor),
      proposedAmountMinor: Number(renewal.proposedAmountMinor),
      renewalAt: new Date(Number(renewal.renewalAt) * 1000).toISOString(),
      cancelled: renewal.cancelled,
      approvedAmountMinor: Number(renewal.approvedAmountMinor),
    },
    notice: {
      status: evidence.notice.status,
      provider: 'Resend',
      providerReceiptId: evidence.notice.providerReceiptId,
      messageId: evidence.notice.messageId,
      providerAcceptedAt: evidence.notice.providerAcceptedAt,
      observedAt: evidence.notice.observedAt,
      recipientSha256: evidence.source.recipientSha256,
      disclosure: evidence.source.disclosure,
    },
    receipt: {
      network: PUBLIC_PROOF.network,
      contract: PUBLIC_PROOF.contract,
      transaction: PUBLIC_PROOF.transaction,
      transactionSucceeded,
      blockNumber: receipt.blockNumber.toString(),
      decisionCount: decisionCount.toString(),
      evidenceHash: decision.evidenceHash,
      evaluatedAt: new Date(Number(decision.evaluatedAt) * 1000).toISOString(),
      forwarderResult: receipt.forwarderResult,
    },
  }
}
