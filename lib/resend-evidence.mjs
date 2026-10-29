import { createHash } from 'node:crypto'

const API = 'https://api.resend.com'
const SUBJECT = 'Avow renewal notice — Northstar Cloud — $29.00'
const SUBSCRIPTION_ID = 'sub_demo_price_increase'

function required(value, name) {
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

async function resend(path, options = {}, fetchImpl = fetch) {
  const key = required(process.env.RESEND_API_KEY, 'RESEND_API_KEY')
  const response = await fetchImpl(`${API}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.message || `Resend returned HTTP ${response.status}`)
    error.status = response.status
    throw error
  }
  return body
}

export async function sendRenewalNotice(fetchImpl = fetch) {
  const recipient = required(process.env.AVOW_NOTICE_RECIPIENT, 'AVOW_NOTICE_RECIPIENT')
  const renewalAt = '2026-11-20T12:00:00.000Z'
  return resend('/emails', {
    method: 'POST',
    headers: { 'Idempotency-Key': `avow/${SUBSCRIPTION_ID}/usd-29-v1` },
    body: JSON.stringify({
      from: 'Avow Demo <onboarding@resend.dev>',
      to: [recipient],
      subject: SUBJECT,
      text: [
        'Northstar Cloud renewal notice',
        '',
        'Your subscription is proposed to renew on 20 November 2026.',
        'Previous amount: $19.00',
        'Proposed amount: $29.00',
        '',
        'No charge has been made. Avow requires fresh approval for the new amount.',
        `Reference: ${SUBSCRIPTION_ID}`,
      ].join('\n'),
      tags: [
        { name: 'subscription', value: 'avow_demo_price_increase' },
        { name: 'policy', value: 'uk_sub_2026_1' },
      ],
    }),
  }, fetchImpl).then(data => ({ ...data, renewalAt }))
}

export async function retrieveRenewalEvidence(emailId, fetchImpl = fetch, now = new Date()) {
  if (!/^[0-9a-f-]{30,40}$/i.test(emailId || '')) {
    const error = new Error('A valid Resend email ID is required')
    error.status = 400
    throw error
  }
  const email = await resend(`/emails/${encodeURIComponent(emailId)}`, {}, fetchImpl)
  const expectedRecipient = required(process.env.AVOW_NOTICE_RECIPIENT, 'AVOW_NOTICE_RECIPIENT')
  const recipients = Array.isArray(email.to) ? email.to : []
  if (email.subject !== SUBJECT || !recipients.includes(expectedRecipient)) {
    const error = new Error('Provider record does not match the Avow renewal notice')
    error.status = 409
    throw error
  }
  const delivered = ['delivered', 'opened', 'clicked'].includes(email.last_event)
  const observedAt = delivered
    ? new Date(
        required(
          process.env.AVOW_DELIVERY_OBSERVED_AT,
          'AVOW_DELIVERY_OBSERVED_AT',
        ),
      ).toISOString()
    : now.toISOString()
  return {
    evidenceVersion: '1.1',
    subscriptionId: SUBSCRIPTION_ID,
    merchant: 'Northstar Cloud',
    currency: 'USD',
    previousAmountMinor: 1900,
    proposedAmountMinor: 2900,
    renewalAt: '2026-11-20T12:00:00.000Z',
    notice: {
      status: delivered ? 'delivered' : email.last_event,
      deliveredAt: delivered ? observedAt : null,
      providerAcceptedAt: new Date(email.created_at).toISOString(),
      providerReceiptId: email.id,
      messageId: email.message_id || null,
      observedProviderEvent: email.last_event,
      observedAt,
    },
    customer: { cancelledAt: null, approvedAmountMinor: null, approvedAt: null },
    source: {
      kind: 'resend-provider-record',
      verifiedDelivery: delivered,
      recipientSha256: createHash('sha256').update(expectedRecipient.toLowerCase()).digest('hex'),
      disclosure: delivered
        ? 'Resend reports delivery. deliveredAt is the conservative time Avow observed that status, not the mail server event timestamp.'
        : 'Resend has not reported delivery. The renewal must not execute.',
    },
  }
}
