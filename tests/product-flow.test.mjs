import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('presents a complete renewal review journey', () => {
  for (const phrase of [
    'Inspect decision',
    'Verify canonical proof',
    'Avow made this decision automatically.',
    'Fresh approval is required.',
    'View verification',
  ]) assert.ok(html.includes(phrase), `Missing product step: ${phrase}`)
})

test('explains the post-setup business experience honestly', () => {
  for (const phrase of [
    'Connected',
    'How a business connects',
    'Connect once. Avow evaluates renewals automatically.',
    'does not yet provide public self-service provisioning',
  ]) assert.ok(html.includes(phrase), `Missing integration disclosure: ${phrase}`)
})

test('gives first-time visitors a direct demo path', () => {
  for (const phrase of [
    'Demo guide',
    'See Avow enforce a renewal',
    'Inspect the blocked decision',
    'Verify the live control',
    'Follow the proof',
    'Start with the decision',
  ]) assert.ok(html.includes(phrase), `Missing guide step: ${phrase}`)
  assert.match(html, /\$\('startGuide'\)\.onclick/)
  assert.match(html, /e\.key===['"]Escape['"]/)
})

test('uses canonical status and fails closed on inconsistent enforcement', () => {
  assert.match(html, /fetch\('\/api\/status'/)
  assert.match(html, /d\.canonical/)
  assert.match(html, /d\.decision!==['"]BLOCK['"]/)
  assert.match(html, /d\.enforcement\?\.canSettle!==false/)
})

test('contains clean Etherscan URL templates', () => {
  assert.match(html, /`https:\/\/sepolia\.etherscan\.io\/tx\/\$\{d\.receipt\.transaction\}`/)
  assert.match(html, /`https:\/\/sepolia\.etherscan\.io\/address\/\$\{d\.enforcement\.escrow\}`/)
  assert.doesNotMatch(html, /\[https:\/\/sepolia\.etherscan/)
})

test('does not misrepresent the verification button as a new CRE execution', () => {
  assert.ok(html.includes('Checks the CRE receipt and funded escrow live.'))
  assert.ok(html.includes('Live canonical record'))
})
