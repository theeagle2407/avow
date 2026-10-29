import { sendRenewalNotice } from '../../lib/resend-evidence.mjs'

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  if (!process.env.AVOW_ADMIN_SECRET || request.headers['x-avow-admin-secret'] !== process.env.AVOW_ADMIN_SECRET) {
    return response.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const result = await sendRenewalNotice()
    return response.status(201).json({
      ok: true,
      emailId: result.id,
      renewalAt: result.renewalAt,
      next: `/api/evidence/live-renewal?emailId=${result.id}`,
    })
  } catch (error) {
    return response.status(error.status || 502).json({ error: error.message })
  }
}
