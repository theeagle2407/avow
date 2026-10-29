import {
  bytesToHex,
  encodeCallMsg,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  type Runtime,
  EVMClient,
} from '@chainlink/cre-sdk'
import {
  decodeFunctionResult,
  encodeFunctionData,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'

export type RenewalSnapshot = {
  customer: Address
  merchant: Address
  previousAmountMinor: bigint
  proposedAmountMinor: bigint
  renewalAt: bigint
  approvedAt: bigint
  approvedAmountMinor: bigint
  cancelled: boolean
  policyId: Hex
}

export const AvowDecisionReceiverABI = [
  {
    type: 'function',
    name: 'getRenewal',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [
      {
        name: 'renewal',
        type: 'tuple',
        components: [
          { name: 'customer', type: 'address' },
          { name: 'merchant', type: 'address' },
          { name: 'previousAmountMinor', type: 'uint256' },
          { name: 'proposedAmountMinor', type: 'uint256' },
          { name: 'renewalAt', type: 'uint64' },
          { name: 'approvedAt', type: 'uint64' },
          { name: 'approvedAmountMinor', type: 'uint256' },
          { name: 'cancelled', type: 'bool' },
          { name: 'policyId', type: 'bytes32' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'recordDecision',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'subscriptionId', type: 'bytes32' },
      { name: 'execute', type: 'bool' },
      { name: 'code', type: 'bytes32' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'evaluatedAt', type: 'uint64' },
    ],
    outputs: [],
  },
] as const

export class AvowDecisionReceiver {
  constructor(
    private readonly client: EVMClient,
    public readonly address: Address,
  ) {}

  getRenewal(runtime: Runtime<unknown>, subscriptionId: Hex): RenewalSnapshot {
    const data = encodeFunctionData({
      abi: AvowDecisionReceiverABI,
      functionName: 'getRenewal',
      args: [subscriptionId],
    })
    const response = this.client
      .callContract(runtime, {
        call: encodeCallMsg({ from: zeroAddress, to: this.address, data }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    return decodeFunctionResult({
      abi: AvowDecisionReceiverABI,
      functionName: 'getRenewal',
      data: bytesToHex(response.data),
    }) as RenewalSnapshot
  }

  writeDecisionReport(
    runtime: Runtime<unknown>,
    input: {
      subscriptionId: Hex
      execute: boolean
      code: Hex
      evidenceHash: Hex
      evaluatedAt: bigint
    },
    gasLimit: string,
  ) {
    const callData = encodeFunctionData({
      abi: AvowDecisionReceiverABI,
      functionName: 'recordDecision',
      args: [
        input.subscriptionId,
        input.execute,
        input.code,
        input.evidenceHash,
        input.evaluatedAt,
      ],
    })
    const report = runtime.report(prepareReportRequest(callData)).result()
    return this.client
      .writeReport(runtime, {
        receiver: this.address,
        report,
        gasConfig: { gasLimit },
      })
      .result()
  }
}
