import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createPublicClient, createWalletClient, fallback, formatEther, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { compileEscrow } from './compile-escrow.mjs'

const rawKey = process.env.CRE_ETH_PRIVATE_KEY?.trim()
if (!rawKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(rawKey)) throw new Error('CRE_ETH_PRIVATE_KEY is missing or invalid.')
const account = privateKeyToAccount(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`)
const deployment = JSON.parse(await readFile(new URL('../deployments/sepolia.json', import.meta.url), 'utf8'))
const transport = fallback([http('https://ethereum-sepolia-rpc.publicnode.com'), http('https://rpc.sepolia.org')])
const publicClient = createPublicClient({ chain: sepolia, transport })
const walletClient = createWalletClient({ account, chain: sepolia, transport })
const artifact = await compileEscrow()
const amount = 100_000_000_000_000n

console.log(`Deploying test escrow from ${account.address}; private key will not be printed.`)
const deployHash = await walletClient.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode, args: [deployment.contract, deployment.subscriptionId, account.address, account.address, amount] })
const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash })
if (deployReceipt.status !== 'success' || !deployReceipt.contractAddress) throw new Error('Escrow deployment failed.')
const escrow = deployReceipt.contractAddress

const fundingHash = await walletClient.writeContract({ address: escrow, abi: artifact.abi, functionName: 'fund', value: amount })
const fundingReceipt = await publicClient.waitForTransactionReceipt({ hash: fundingHash })
if (fundingReceipt.status !== 'success') throw new Error('Escrow funding failed.')

let settlementBlocked = false
try {
  await publicClient.simulateContract({ account, address: escrow, abi: artifact.abi, functionName: 'settle' })
} catch (error) {
  settlementBlocked = String(error).includes('SettlementNotAuthorized')
}
if (!settlementBlocked) throw new Error('Escrow did not prove that the BLOCK decision prevents settlement.')

const [decision, canSettle, heldBalance] = await publicClient.readContract({
  address: escrow,
  abi: artifact.abi,
  functionName: 'settlementStatus',
  blockNumber: fundingReceipt.blockNumber,
})

if (
  Number(decision) !== 2 ||
  canSettle !== false ||
  heldBalance !== amount
) {
  throw new Error(
    'Funded escrow state does not enforce the canonical BLOCK decision.',
  )
}

const result = {
  network: 'ethereum-testnet-sepolia',
  escrow,
  receiver: deployment.contract,
  subscriptionId: deployment.subscriptionId,
  amountWei: amount.toString(),
  amountEth: formatEther(amount),
  decision: 'BLOCK',
  canSettle,
  heldBalanceWei: heldBalance.toString(),
  settlementBlocked,
  verificationBlock: fundingReceipt.blockNumber.toString(),
  deploymentTransaction: deployHash,
  fundingTransaction: fundingHash,
  transactionsSent: 2,
  disclosure:
    'Sepolia ETH test escrow. No production funds or stablecoins were used.',
}
await mkdir(new URL('../deployments/', import.meta.url), { recursive: true })
await writeFile(new URL('../deployments/escrow-sepolia.json', import.meta.url), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
console.log('ESCROW ENFORCEMENT PASSED — the canonical BLOCK decision prevents settlement.')
