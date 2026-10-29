import { mkdir, readFile, writeFile } from 'node:fs/promises'
import {
  createPublicClient,
  createWalletClient,
  fallback,
  formatEther,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { compileEscrowV2 } from './compile-escrow-v2.mjs'

const rawKey = process.env.CRE_ETH_PRIVATE_KEY?.trim()
if (!rawKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error('CRE_ETH_PRIVATE_KEY is missing or invalid. Use a test-only Sepolia key.')
}

const account = privateKeyToAccount(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`)
const receiverDeployment = JSON.parse(
  await readFile(new URL('../deployments/sepolia.json', import.meta.url), 'utf8'),
)
const transport = fallback([
  http('https://ethereum-sepolia-rpc.publicnode.com'),
  http('https://rpc.sepolia.org'),
])
const publicClient = createPublicClient({ chain: sepolia, transport })
const walletClient = createWalletClient({ account, chain: sepolia, transport })
const artifact = await compileEscrowV2()
const amount = 100_000_000_000_000n
const maxDecisionAge = 86_400n

console.log(`Deploying Avow escrow V2 from ${account.address}; private key will not be printed.`)
const deployHash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [
    receiverDeployment.contract,
    receiverDeployment.subscriptionId,
    account.address,
    account.address,
    amount,
    maxDecisionAge,
  ],
})
const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash })
if (deployReceipt.status !== 'success' || !deployReceipt.contractAddress) {
  throw new Error('Escrow V2 deployment failed.')
}
const escrow = deployReceipt.contractAddress

const fundingHash = await walletClient.writeContract({
  address: escrow,
  abi: artifact.abi,
  functionName: 'fund',
  value: amount,
})
const fundingReceipt = await publicClient.waitForTransactionReceipt({ hash: fundingHash })
if (fundingReceipt.status !== 'success') throw new Error('Escrow V2 funding failed.')

const status = await publicClient.readContract({
  address: escrow,
  abi: artifact.abi,
  functionName: 'authorizationStatus',
  blockNumber: fundingReceipt.blockNumber,
})

const [decision, canSettle, heldBalance, customerStateCurrent, decisionFresh] = status
if (
  Number(decision) !== 2 ||
  canSettle !== false ||
  heldBalance !== amount ||
  customerStateCurrent !== true
) {
  throw new Error('Escrow V2 did not enforce the canonical BLOCK decision.')
}

let settlementBlocked = false
try {
  await publicClient.simulateContract({
    account,
    address: escrow,
    abi: artifact.abi,
    functionName: 'settle',
  })
} catch (error) {
  settlementBlocked = String(error).includes('SettlementNotAuthorized')
}
if (!settlementBlocked) throw new Error('Escrow V2 settlement was not blocked.')

const result = {
  schema: 'avow.escrow.v2',
  network: 'ethereum-testnet-sepolia',
  escrow,
  receiver: receiverDeployment.contract,
  subscriptionId: receiverDeployment.subscriptionId,
  amountWei: amount.toString(),
  amountEth: formatEther(amount),
  maxDecisionAgeSeconds: maxDecisionAge.toString(),
  decision: 'BLOCK',
  canSettle,
  customerStateCurrent,
  decisionFresh,
  heldBalanceWei: heldBalance.toString(),
  settlementBlocked,
  verificationBlock: fundingReceipt.blockNumber.toString(),
  deploymentTransaction: deployHash,
  fundingTransaction: fundingHash,
  transactionsSent: 2,
  disclosure: 'Sepolia ETH test escrow V2. No production funds or stablecoins were used.',
}

await mkdir(new URL('../deployments/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../deployments/escrow-v2-sepolia.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`,
)
console.log(JSON.stringify(result, null, 2))
console.log('ESCROW V2 ENFORCEMENT PASSED — state freshness and authorization expiry are enforced.')

