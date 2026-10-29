const fixtures = Object.freeze({
  compliant: {
    evidenceVersion: '1.0',
    subscriptionId: 'sub_demo_compliant',
    merchant: 'Northstar Cloud',
    currency: 'USD',
    previousAmountMinor: 1900,
    proposedAmountMinor: 1900,
    renewalAt: '2026-11-20T12:00:00.000Z',
    notice: {
      status: 'delivered',
      deliveredAt: '2026-11-10T12:00:00.000Z',
      providerReceiptId: 'fixture_delivery_compliant',
    },
    customer: { cancelledAt: null, approvedAmountMinor: null, approvedAt: null },
  },
  'price-increase': {
    evidenceVersion: '1.0',
    subscriptionId: 'sub_demo_price_increase',
    merchant: 'Northstar Cloud',
    currency: 'USD',
    previousAmountMinor: 1900,
    proposedAmountMinor: 2900,
    renewalAt: '2026-11-20T12:00:00.000Z',
    notice: {
      status: 'delivered',
      deliveredAt: '2026-11-10T12:00:00.000Z',
      providerReceiptId: 'fixture_delivery_price_increase',
    },
    customer: { cancelledAt: null, approvedAmountMinor: null, approvedAt: null },
  },
  cancelled: {
    evidenceVersion: '1.0',
    subscriptionId: 'sub_demo_cancelled',
    merchant: 'Northstar Cloud',
    currency: 'USD',
    previousAmountMinor: 1900,
    proposedAmountMinor: 1900,
    renewalAt: '2026-11-20T12:00:00.000Z',
    notice: {
      status: 'delivered',
      deliveredAt: '2026-11-10T12:00:00.000Z',
      providerReceiptId: 'fixture_delivery_cancelled',
    },
    customer: {
      cancelledAt: '2026-11-12T09:30:00.000Z',
      approvedAmountMinor: null,
      approvedAt: null,
    },
  },
  'late-notice': {
    evidenceVersion: '1.0',
    subscriptionId: 'sub_demo_late_notice',
    merchant: 'Northstar Cloud',
    currency: 'USD',
    previousAmountMinor: 1900,
    proposedAmountMinor: 1900,
    renewalAt: '2026-11-20T12:00:00.000Z',
    notice: {
      status: 'delivered',
      deliveredAt: '2026-11-18T12:00:00.000Z',
      providerReceiptId: 'fixture_delivery_late_notice',
    },
    customer: { cancelledAt: null, approvedAmountMinor: null, approvedAt: null },
  },
})

export const fixtureNames = Object.freeze(Object.keys(fixtures))

export const getDemoEvidence = (scenario = 'price-increase') => {
  const evidence = fixtures[scenario]
  if (!evidence) return null
  return {
    ...structuredClone(evidence),
    source: {
      kind: 'demo-fixture',
      verifiedDelivery: false,
      disclosure: 'Demonstration evidence only. This is not a live provider receipt.',
    },
  }
}

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const requested = Array.isArray(request.query?.scenario)
    ? request.query.scenario[0]
    : request.query?.scenario
  const scenario = requested || 'price-increase'
  const evidence = getDemoEvidence(scenario)

  if (!evidence) {
    return response.status(400).json({
      error: 'Unknown scenario',
      allowedScenarios: fixtureNames,
    })
  }

  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60')
  return response.status(200).json(evidence)
}
