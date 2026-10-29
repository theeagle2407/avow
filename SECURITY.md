# Security

Avow is a hackathon prototype running on Ethereum Sepolia. Do not use it with production funds.

## Trust boundaries

- Resend is the delivery-evidence provider for the canonical demonstration.
- Chainlink CRE retrieves evidence and produces the signed decision report.
- The configured Chainlink forwarder is the only caller accepted by the decision receiver.
- The public status API verifies a fixed canonical demonstration; it is not a general-purpose indexer.
- Vercel stores provider and administrative secrets.

## Known limitations

1. The escrow demonstrates a `BLOCK` decision with Sepolia ETH; it is not a production payment rail.
2. Enforcement V2 invalidates settlement after cancellation or a later approval update and expires authorizations after 24 hours. A production design should additionally commit to a generalized version/hash if renewal fields become mutable.
3. The deployment uses the Chainlink Sepolia mock forwarder and an official CRE CLI simulation with broadcast.
4. Provider delivery proves the provider's reported event, not that a human read or understood the notice.
5. The contracts have not been professionally audited.
6. The demo policy is not legal advice and must be replaced or approved for each deployment.

## Secret handling

- `.env`, `.env.*`, `contracts/.env`, `.avow-admin-secret`, Vercel state and generated CRE output are ignored.
- Use a dedicated test-only wallet for `CRE_ETH_PRIVATE_KEY`.
- Rotate any credential that is accidentally committed or pasted into a public issue.
- Never place recipient email addresses in source, logs, public APIs or onchain reports.

## Reporting

Please report security issues privately to the repository owner rather than opening a public issue containing exploit details.

