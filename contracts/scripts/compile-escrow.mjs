import { mkdir, readFile, writeFile } from 'node:fs/promises'
import solc from 'solc'

export async function compileEscrow() {
  const source = await readFile(new URL('../src/AvowRenewalEscrow.sol', import.meta.url), 'utf8')
  const input = { language: 'Solidity', sources: { 'AvowRenewalEscrow.sol': { content: source } }, settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = (output.errors || []).filter(item => item.severity === 'error')
  if (errors.length) throw new Error(errors.map(item => item.formattedMessage).join('\n'))
  const compiled = output.contracts?.['AvowRenewalEscrow.sol']?.AvowRenewalEscrow
  if (!compiled?.evm?.bytecode?.object) throw new Error('Escrow bytecode was not produced.')
  const artifact = { contractName: 'AvowRenewalEscrow', abi: compiled.abi, bytecode: `0x${compiled.evm.bytecode.object}` }
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true })
  await writeFile(new URL('../artifacts/AvowRenewalEscrow.json', import.meta.url), `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifact = await compileEscrow()
  console.log(`ESCROW COMPILE PASSED — ${artifact.abi.length} ABI entries; no deployment performed.`)
}
