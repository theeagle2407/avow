# Threat model

## Protected outcome

Settlement should occur only when the configured renewal policy returns `EXECUTE` for evidence and customer state that belong to the same subscription.

## Existing controls

| Threat | Current control |
| --- | --- |
| Untrusted caller submits a decision | Receiver accepts only the configured Chainlink forwarder |
| Evidence is replayed | `consumedEvidence` rejects a reused evidence hash |
| Provider record belongs to another notice | Subject and recipient are checked before evidence is produced |
| Recipient identity leaks | Public evidence exposes only a SHA-256 commitment |
| UI/API mixes inconsistent records | `/api/status` compares the fixed evidence hash, code, transaction and escrow state |
| External dependency fails | Status and workflow fail closed |
| BLOCK decision is ignored | Escrow checks the receiver before releasing funds |
| Old EXECUTE decision is reused | Enforcement V2 expires decisions after 24 hours |
| Customer changes state after evaluation | Cancellation or a later approval update invalidates settlement |

## Further production hardening

### State freshness

Enforcement V2 compares evaluation time with approval state, rejects cancellation, and imposes a 24-hour authorization lifetime. If future versions make additional renewal fields mutable, the decision should also include:

- a hash or monotonically increasing version of the renewal state;
- an issuance timestamp validated against block time; and
- an explicit settlement deadline chosen for the payment rail.

The escrow should continue to release only when the current state commitment matches the decision and the decision is unexpired.

### Policy governance

Policies should be immutable by version, reviewed by qualified counsel, and activated through an auditable governance process. The contract should record the exact policy version used for each decision.

### Evidence authenticity

Production evidence should use provider webhooks or signed provider attestations where available. Administrative access, webhook signatures, replay protection and key rotation must be tested.

### Contract assurance

Add unit, fuzz and invariant tests for both contracts, then complete an independent audit before handling real assets.

