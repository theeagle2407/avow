# Demonstration policy

`UK-SUB-2026.1` is Avow's internal identifier for the configured hackathon control. It is not the title of legislation, a legal opinion, or a claim of universal applicability.

## Implemented rules

| Condition | Decision code | Result |
| --- | --- | --- |
| Customer cancellation is recorded | `CUSTOMER_CANCELLED` | BLOCK |
| Provider delivery is absent or unverified | `NOTICE_NOT_DELIVERED` | BLOCK |
| Notice is below the configured seven-day threshold | `NOTICE_TOO_LATE` | BLOCK |
| Amount changed without approval for the exact amount after notice | `FRESH_APPROVAL_REQUIRED` | BLOCK |
| All configured checks pass | `RENEWAL_COMPLIANT` | EXECUTE |

The seven-day interval is a merchant policy parameter in this prototype. It is not presented as a universal statutory period.

## Legal context

The UK Digital Markets, Competition and Consumers Act 2024 contains subscription-contract reminder-notice duties. Section 259 requires the reminder period specified by the trader to be reasonably in advance of the last cancellation date so the consumer can decide and act before liability arises. The Consumer Subscription Contracts regulations and official guidance provide further requirements.

Relevant official sources:

- https://www.gov.uk/government/publications/subscription-contracts
- https://www.legislation.gov.uk/ukpga/2024/13/section/258
- https://www.legislation.gov.uk/ukpga/2024/13/section/259

Avow demonstrates how a reviewed legal or contractual control can become verifiable execution. A production deployment must translate the applicable law and contract into approved, versioned policy rules with counsel.

