# Chainlink CRE integration

## Execution path

1. `CronCapability` triggers the workflow.
2. `EVMClient` reads the Sepolia renewal through `AvowDecisionReceiver`.
3. `HTTPClient` retrieves the Resend-backed evidence record.
4. `consensusIdenticalAggregation` requires identical evidence across observations.
5. The workflow checks the policy identifier and subscription commitment.
6. `evaluateRenewal` produces `EXECUTE` or `BLOCK` deterministically.
7. The combined onchain/offchain evidence is hashed.
8. The workflow generates a receiver report and writes it through the Chainlink forwarder.

## Canonical execution

- CRE CLI: v1.39.0
- CRE SDK: v1.23.0
- Network: Ethereum Sepolia
- Receiver: `0x904f247794a68f83ec90f441718b88f67d99e98c`
- Broadcast transaction: `0x2b11599ad5c75d5732dba55eeb69dd9c60691e12dc54d85ceba754ee804b349b`
- Evidence hash: `0xfe4f340c7a3a2c70a4d714e4a529d96714bf88b1b03d49ea93ab1d5534859e86`
- Decision: `BLOCK`
- Code: `FRESH_APPROVAL_REQUIRED`

The workflow was executed using official CRE CLI simulation with broadcast. It is not a claim of continuous CRE-network deployment.

