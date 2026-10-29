import {
  bytesToHex,
  consensusIdenticalAggregation,
  type CronPayload,
  cre,
  getNetwork,
  type HTTPSendRequester,
  json,
  Runner,
  type Runtime,
  TxStatus,
} from '@chainlink/cre-sdk'
import {
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from 'viem'
import { AvowDecisionReceiver } from './contracts/AvowDecisionReceiver'
import { assertEvidence, evaluateRenewal, type RenewalEvidence } from './policy'

type Config = {
  schedule: string
  evidenceUrl: string
  policyId: string
  chainSelectorName: string
  receiverAddress: string
  subscriptionId: string
  gasLimit: string
}

const fetchEvidence = (sendRequester: HTTPSendRequester, config: Config): string => {
  const response = sendRequester
    .sendRequest({
      url: config.evidenceUrl,
      method: 'GET' as const,
      headers: { Accept: 'application/json' },
    })
    .result()
  if (response.statusCode !== 200) {
    throw new Error(`Evidence request failed with status ${response.statusCode}`)
  }
  return JSON.stringify(assertEvidence(json(response)))
}

const onRenewalCheck = (runtime: Runtime<Config>, payload: CronPayload): string => {
  if (!payload.scheduledExecutionTime) {
    throw new Error('Scheduled execution time is required')
  }

  const network = getNetwork({
    chainFamily: 'evm',
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  })
  if (!network) throw new Error(`Unsupported network: ${runtime.config.chainSelectorName}`)

  const subscriptionId = runtime.config.subscriptionId as Hex
  const expectedPolicyId = keccak256(stringToHex(runtime.config.policyId))
  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)
  const receiver = new AvowDecisionReceiver(
    evmClient,
    runtime.config.receiverAddress as Address,
  )

  runtime.log(`Reading renewal from Sepolia | subscription=${subscriptionId}`)
  const renewal = receiver.getRenewal(runtime, subscriptionId)
  if (renewal.policyId.toLowerCase() !== expectedPolicyId.toLowerCase()) {
    throw new Error('Onchain policy ID does not match workflow policy')
  }

  runtime.log(`Fetching notice evidence | policy=${runtime.config.policyId}`)
  const httpClient = new cre.capabilities.HTTPClient()
  const evidenceJson = httpClient
    .sendRequest(
      runtime,
      fetchEvidence,
      consensusIdenticalAggregation<string>(),
    )(runtime.config)
    .result()
  const externalEvidence = assertEvidence(JSON.parse(evidenceJson) as RenewalEvidence)
  const externalSubscriptionId = keccak256(stringToHex(externalEvidence.subscriptionId))
  if (externalSubscriptionId.toLowerCase() !== subscriptionId.toLowerCase()) {
    throw new Error('External evidence does not match the onchain subscription')
  }

  const combinedEvidence: RenewalEvidence = {
    ...externalEvidence,
    previousAmountMinor: Number(renewal.previousAmountMinor),
    proposedAmountMinor: Number(renewal.proposedAmountMinor),
    renewalAt: new Date(Number(renewal.renewalAt) * 1000).toISOString(),
    customer: {
      cancelledAt: renewal.cancelled ? 'onchain-cancellation' : null,
      approvedAmountMinor:
        renewal.approvedAmountMinor === 0n ? null : Number(renewal.approvedAmountMinor),
      approvedAt:
        renewal.approvedAt === 0n
          ? null
          : new Date(Number(renewal.approvedAt) * 1000).toISOString(),
    },
  }

  const decision = evaluateRenewal(combinedEvidence)
  const evaluatedAt = payload.scheduledExecutionTime.seconds
  const evidenceHash = keccak256(
    stringToHex(
      JSON.stringify({
        policyId: runtime.config.policyId,
        external: externalEvidence,
        onchain: {
          customer: renewal.customer,
          merchant: renewal.merchant,
          previousAmountMinor: renewal.previousAmountMinor.toString(),
          proposedAmountMinor: renewal.proposedAmountMinor.toString(),
          renewalAt: renewal.renewalAt.toString(),
          approvedAt: renewal.approvedAt.toString(),
          approvedAmountMinor: renewal.approvedAmountMinor.toString(),
          cancelled: renewal.cancelled,
          policyId: renewal.policyId,
        },
      }),
    ),
  )
  const codeHash = keccak256(stringToHex(decision.code))

  runtime.log(`Writing CRE decision | decision=${decision.decision} | code=${decision.code}`)
  const write = receiver.writeDecisionReport(
    runtime,
    {
      subscriptionId,
      execute: decision.decision === 'EXECUTE',
      code: codeHash,
      evidenceHash,
      evaluatedAt,
    },
    runtime.config.gasLimit,
  )
  if (write.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Decision write failed: ${write.errorMessage || write.txStatus}`)
  }

  const result = {
    schema: 'avow.decision.v1',
    policyId: runtime.config.policyId,
    subscriptionId: externalEvidence.subscriptionId,
    decision: decision.decision,
    code: decision.code,
    explanation: decision.explanation,
    noticeDays: decision.noticeDays,
    priceChangePercent: decision.priceChangePercent,
    evidenceHash,
    transactionHash: write.txHash ? bytesToHex(write.txHash) : null,
  }
  runtime.log(`Avow completed | decision=${result.decision} | tx=${result.transactionHash}`)
  return JSON.stringify(result, null, 2)
}

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability()
  return [cre.handler(cron.trigger({ schedule: config.schedule }), onRenewalCheck)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

main()
