import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleStatus, PUBLIC_PROOF } from '../lib/status.mjs'

const input = {
  evidence: { merchant: 'Northstar Cloud', currency: 'USD', notice: { status: 'delivered', providerReceiptId: 'receipt', messageId: '<message>', providerAcceptedAt: '2026-10-29T15:06:07.246Z', observedAt: '2026-10-29T15:06:46.849Z' }, source: { verifiedDelivery: true, recipientSha256: 'a'.repeat(64), disclosure: 'Conservative observation.' } },
  renewal: { previousAmountMinor: 1900n, proposedAmountMinor: 2900n, renewalAt: 1795176000n, cancelled: false, approvedAmountMinor: 0n },
  decision: { value: 2, codeMatches: true, evidenceHash: PUBLIC_PROOF.evidenceHash, evaluatedAt: 1793287020n },
  decisionCount: 3n,
  receipt: { status: 'success', blockNumber: 12020350n, forwarderResult: true },
  escrow: { funded: true, released: false, decision: 2, canSettle: false, heldBalanceWei: PUBLIC_PROOF.escrowAmountWei },
}

test('assembles a canonical blocked renewal from independent proof', () => {
  const status = assembleStatus(input)
  assert.equal(status.canonical, true)
  assert.equal(status.decision, 'BLOCK')
  assert.equal(status.receipt.decisionCount, '3')
})

test('fails closed when the evidence hash differs', () => {
  const status = assembleStatus({ ...input, decision: { ...input.decision, evidenceHash: `0x${'0'.repeat(64)}` } })
  assert.equal(status.canonical, false)
  assert.equal(status.decision, 'UNVERIFIED')
})

test('rejects evidence without verified delivery', () => {
  assert.throws(() => assembleStatus({ ...input, evidence: { ...input.evidence, source: { ...input.evidence.source, verifiedDelivery: false } } }), /not verified/)
})

test('fails closed if blocked funds become settleable', () => {
  const status = assembleStatus({ ...input, escrow: { ...input.escrow, canSettle: true } })
  assert.equal(status.canonical, false)
  assert.equal(status.decision, 'UNVERIFIED')
})
