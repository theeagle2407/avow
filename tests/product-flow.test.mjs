import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

test('opens with the product rather than a stranger-looking renewal', () => {
  for (const phrase of [
    'Recurring payments should prove permission.',
    'Avow is a verification and enforcement layer',
    'No valid permission.',
    'Explore verified demo',
    'Built with Chainlink CRE',
  ]) assert.ok(html.includes(phrase), `Missing product framing: ${phrase}`)
  assert.match(html, /<section class="screen active" id="product">/)
  assert.match(html, /<section class="screen" id="review">/)
})

test('states who uses Avow and where it sits', () => {
  for (const phrase of [
    'Subscription platforms',
    'Onchain memberships',
    'Marketplaces',
    'Renewal proposed',
    'Evidence verified',
    'CRE evaluates',
    'Settlement obeys',
  ]) assert.ok(html.includes(phrase), `Missing product concept: ${phrase}`)
})

test('labels the fixed case as a reference demo rather than visitor data', () => {
  for (const phrase of [
    'Verified reference demo.',
    'one fixed test renewal',
    'it is not your subscription',
    'single disclosed test case—not visitor data',
  ]) assert.ok(html.includes(phrase), `Missing demo disclosure: ${phrase}`)
  assert.ok(!html.includes('Northstar'), 'Fixture merchant must not appear publicly')
})

test('does not expose fake self-serve product actions', () => {
  for (const phrase of [
    'Save local draft',
    'Prepare integration',
    'Create renewal',
    'Connect wallet',
    'Run live verification',
  ]) assert.ok(!html.includes(phrase), `Misleading public action remains: ${phrase}`)
})

test('explains the real developer integration and prototype boundary', () => {
  for (const phrase of [
    'The integration boundary',
    'Renewal source',
    'Notice provider',
    'Consent state',
    'Settlement contract',
    'end customers do not operate this console',
    'does not claim self-serve account provisioning',
  ]) assert.ok(html.includes(phrase), `Missing integration truth: ${phrase}`)
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

test('describes proof inspection without claiming to execute a new CRE run', () => {
  assert.ok(html.includes('Inspect live proof'))
  assert.ok(html.includes('Reads the existing provider evidence, CRE receipt and funded escrow.'))
})
