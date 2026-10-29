import { createPublicClient, http, keccak256, stringToHex } from 'viem'
import { sepolia } from 'viem/chains'
import { assembleStatus, PUBLIC_PROOF } from '../lib/status.mjs'

const abi = [
  { type: 'function', name: 'getRenewal', stateMutability: 'view', inputs: [{ name: 'subscriptionId', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'customer', type: 'address' }, { name: 'merchant', type: 'address' },
    { name: 'previousAmountMinor', type: 'uint256' }, { name: 'proposedAmountMinor', type: 'uint256' },
    { name: 'renewalAt', type: 'uint64' }, { name: 'approvedAt', type: 'uint64' },
    { name: 'approvedAmountMinor', type: 'uint256' }, { name: 'cancelled', type: 'bool' },
    { name: 'policyId', type: 'bytes32' },
  ] }] },
  { type: 'function', name: 'decisionCount', stateMutability: 'view', inputs: [{ name: 'subscriptionId', type: 'bytes32' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'latestDecision', stateMutability: 'view', inputs: [{ name: 'subscriptionId', type: 'bytes32' }], outputs: [{ name: '', type: 'tuple', components: [
    { name: 'decision', type: 'uint8' }, { name: 'code', type: 'bytes32' },
    { name: 'evidenceHash', type: 'bytes32' }, { name: 'evaluatedAt', type: 'uint64' },
  ] }] },
]

const reportTopic = '0x3617b009e9785c42daebadb6d3fb553243a4bf586d07ea72d65d80013ce116b5'
const escrowAbi = [
  { type: 'function', name: 'funded', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'released', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'settlementStatus', stateMutability: 'view', inputs: [], outputs: [
    { name: 'decision', type: 'uint8' }, { name: 'canSettle', type: 'bool' }, { name: 'heldBalance', type: 'uint256' },
  ] },
]
const evidenceUrl = 'https://avow-lime.vercel.app/api/evidence/live-renewal?emailId=01a18832-6751-7482-b43c-71087109fe5e'

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  try {
    const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com') })
    const subscriptionId = keccak256(stringToHex(PUBLIC_PROOF.subscriptionId))
    const [evidenceResponse, renewal, count, rawDecision, txReceipt, funded, released, escrowStatus] = await Promise.all([
      fetch(evidenceUrl, { cache: 'no-store' }),
      client.readContract({ address: PUBLIC_PROOF.contract, abi, functionName: 'getRenewal', args: [subscriptionId] }),
      client.readContract({ address: PUBLIC_PROOF.contract, abi, functionName: 'decisionCount', args: [subscriptionId] }),
      client.readContract({ address: PUBLIC_PROOF.contract, abi, functionName: 'latestDecision', args: [subscriptionId] }),
      client.getTransactionReceipt({ hash: PUBLIC_PROOF.transaction }),
      client.readContract({ address: PUBLIC_PROOF.escrow, abi: escrowAbi, functionName: 'funded' }),
      client.readContract({ address: PUBLIC_PROOF.escrow, abi: escrowAbi, functionName: 'released' }),
      client.readContract({ address: PUBLIC_PROOF.escrow, abi: escrowAbi, functionName: 'settlementStatus' }),
    ])
    if (!evidenceResponse.ok) throw new Error(`Evidence service returned HTTP ${evidenceResponse.status}`)
    const evidence = await evidenceResponse.json()
    const forwarderLog = txReceipt.logs.find(log => log.topics[0]?.toLowerCase() === reportTopic)
    const status = assembleStatus({
      evidence, renewal, decisionCount: count,
      decision: { value: Number(rawDecision.decision), codeMatches: rawDecision.code.toLowerCase() === keccak256(stringToHex(PUBLIC_PROOF.decisionCode)).toLowerCase(), evidenceHash: rawDecision.evidenceHash.toLowerCase(), evaluatedAt: rawDecision.evaluatedAt },
      receipt: { status: txReceipt.status, blockNumber: txReceipt.blockNumber, forwarderResult: forwarderLog?.data === `0x${'0'.repeat(63)}1` },
      escrow: { funded, released, decision: Number(escrowStatus[0]), canSettle: escrowStatus[1], heldBalanceWei: escrowStatus[2].toString() },
    })
    response.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=30')
    return response.status(200).json(status)
  } catch (error) {
    return response.status(502).json({ error: 'Live verification unavailable', detail: error.message })
  }
}
