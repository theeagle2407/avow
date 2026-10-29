import assert from 'node:assert/strict'
import test from 'node:test'
import { compileEscrowV2 } from '../scripts/compile-escrow-v2.mjs'

test('AvowRenewalEscrowV2 compiles with the authorization status surface', async () => {
  const artifact = await compileEscrowV2()
  assert.match(artifact.bytecode, /^0x[0-9a-f]+$/i)
  const names = artifact.abi
    .filter(item => item.type === 'function')
    .map(item => item.name)
  assert.ok(names.includes('authorizationStatus'))
  assert.ok(names.includes('settle'))
  assert.ok(names.includes('fund'))
})

