import assert from 'node:assert/strict'
import test from 'node:test'
import handler, { fixtureNames, getDemoEvidence } from '../api/evidence/demo-renewal.mjs'

const invoke = ({ method = 'GET', scenario } = {}) => {
  const result = { statusCode: null, headers: {}, body: null }
  const response = {
    setHeader(name, value) { result.headers[name] = value },
    status(code) { result.statusCode = code; return this },
    json(body) { result.body = body; return result },
  }
  return handler({ method, query: scenario ? { scenario } : {} }, response)
}

test('defaults to the disclosed silent-price-increase fixture', () => {
  const response = invoke()
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.subscriptionId, 'sub_demo_price_increase')
  assert.equal(response.body.source.kind, 'demo-fixture')
  assert.equal(response.body.source.verifiedDelivery, false)
})

test('returns four distinct review scenarios', () => {
  assert.deepEqual(fixtureNames, ['compliant', 'price-increase', 'cancelled', 'late-notice'])
  assert.equal(getDemoEvidence('compliant').proposedAmountMinor, 1900)
  assert.equal(getDemoEvidence('price-increase').proposedAmountMinor, 2900)
  assert.ok(getDemoEvidence('cancelled').customer.cancelledAt)
  assert.equal(getDemoEvidence('late-notice').notice.deliveredAt, '2026-11-18T12:00:00.000Z')
})

test('rejects unknown scenarios without silently substituting data', () => {
  const response = invoke({ scenario: 'invented' })
  assert.equal(response.statusCode, 400)
  assert.equal(response.body.error, 'Unknown scenario')
})

test('rejects non-GET requests', () => {
  const response = invoke({ method: 'POST' })
  assert.equal(response.statusCode, 405)
  assert.equal(response.headers.Allow, 'GET')
})
