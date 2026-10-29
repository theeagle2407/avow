import test from 'node:test'
import assert from 'node:assert/strict'
import { retrieveRenewalEvidence, sendRenewalNotice } from '../lib/resend-evidence.mjs'

process.env.RESEND_API_KEY = 'test-key'
process.env.AVOW_NOTICE_RECIPIENT = 'customer@example.test'
process.env.AVOW_DELIVERY_OBSERVED_AT = '2026-10-29T15:06:46.849Z'

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

test('sends one fixed notice with an idempotency key', async () => {
  let request
  const result = await sendRenewalNotice(async (url, options) => {
    request = { url, options }
    return response({ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })
  })
  assert.equal(result.id, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  assert.equal(request.options.headers['Idempotency-Key'], 'avow/sub_demo_price_increase/usd-29-v1')
  assert.equal(JSON.parse(request.options.body).to[0], process.env.AVOW_NOTICE_RECIPIENT)
})

test('turns a delivered provider record into conservative evidence', async () => {
  const result = await retrieveRenewalEvidence(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    async () => response({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      to: [process.env.AVOW_NOTICE_RECIPIENT],
      subject: 'Avow renewal notice — Northstar Cloud — $29.00',
      created_at: '2026-10-29T15:00:00.000Z',
      last_event: 'delivered',
      message_id: '<avow@example.test>',
    }),
    new Date('2026-10-29T15:01:00.000Z'),
  )
  assert.equal(result.notice.status, 'delivered')
  assert.equal(result.notice.deliveredAt, '2026-10-29T15:06:46.849Z')
  assert.equal(result.source.verifiedDelivery, true)
  assert.equal(JSON.stringify(result).includes(process.env.AVOW_NOTICE_RECIPIENT), false)
})

test('does not claim delivery for a merely sent email', async () => {
  const result = await retrieveRenewalEvidence(
    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    async () => response({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      to: [process.env.AVOW_NOTICE_RECIPIENT],
      subject: 'Avow renewal notice — Northstar Cloud — $29.00',
      created_at: '2026-10-29T15:00:00.000Z',
      last_event: 'sent',
    }),
  )
  assert.equal(result.notice.deliveredAt, null)
  assert.equal(result.source.verifiedDelivery, false)
})

test('rejects a provider record for another notice', async () => {
  await assert.rejects(
    retrieveRenewalEvidence(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      async () => response({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        to: ['other@example.com'],
        subject: 'Different message',
        created_at: '2026-10-29T15:00:00.000Z',
        last_event: 'delivered',
      }),
    ),
    /does not match/,
  )
})
