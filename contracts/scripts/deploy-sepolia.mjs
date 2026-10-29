import { mkdir, writeFile } from 'node:fs/promises'
import {
  createPublicClient,
  createWalletClient,
  fallback,
  http,
  keccak256,
  stringToHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { compileContract } from './compile.mjs'

const MOCK_FORWARDER = '0x15fC6ae953E024d975e77382eEeC56A9101f9F88'
const rawKey = process.env.CRE_ETH_PRIVATE_KEY?.trim()
if (!rawKey || !/^(0x)?[0-9a-fA-F]{64}$/.test(rawKey)) {
  throw new Error('CRE_ETH_PRIVATE_KEY is missing or invalid. Use a test-only Sepolia key.')
}

const account = privateKeyToAccount(rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`)
const transport = fallback([
  http('https://ethereum-sepolia-rpc.publicnode.com'),
  http('https://rpc.sepolia.org'),
])
const publicClient = createPublicClient({ chain: sepolia, transport })
const walletClient = createWalletClient({ account, chain: sepolia, transport })
const artifact = await compileContract()

const balance = await publicClient.getBalance({ address: account.address })
if (balance === 0n) throw new Error('The deployment wallet has no Sepolia ETH.')

console.log(`Deploying from ${account.address}; private key will not be printed.`)
const deploymentHash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [MOCK_FORWARDER],
})
const deploymentReceipt = await publicClient.waitForTransactionReceipt({ hash: deploymentHash })
if (deploymentReceipt.status !== 'success' || !deploymentReceipt.contractAddress) {
  throw new Error('Contract deployment failed.')
}

const address = deploymentReceipt.contractAddress
const subscriptionId = keccak256(stringToHex('sub_demo_price_increase'))
const policyId = keccak256(stringToHex('UK-SUB-2026.1'))
const renewalAt = BigInt(Math.floor(Date.parse('2026-11-20T12:00:00.000Z') / 1000))

const createHash = await walletClient.writeContract({
  address,
  abi: artifact.abi,
  functionName: 'createRenewal',
  args: [
    subscriptionId,
    account.address,
    account.address,
    1900n,
    2900n,
    renewalAt,
    policyId,
  ],
})
const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash })
if (createReceipt.status !== 'success') throw new Error('Demo renewal creation failed.')

const deployment = {
  network: 'ethereum-testnet-sepolia',
  chainId: sepolia.id,
  contract: address,
  mockForwarder: MOCK_FORWARDER,
  deployer: account.address,
  subscriptionId,
  deploymentTransaction: deploymentHash,
  renewalTransaction: createHash,
}

await mkdir(new URL('../deployments/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../deployments/sepolia.json', import.meta.url),
  `${JSON.stringify(deployment, null, 2)}\n`,
)

console.log(JSON.stringify(deployment, null, 2))
console.log('SEPOLIA DEPLOYMENT PASSED — contract and demo renewal are onchain.')
