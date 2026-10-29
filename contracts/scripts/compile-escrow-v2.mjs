import { mkdir, readFile, writeFile } from 'node:fs/promises'
import solc from 'solc'

export async function compileEscrowV2() {
  const source = await readFile(
    new URL('../src/AvowRenewalEscrowV2.sol', import.meta.url),
    'utf8',
  )
  const input = {
    language: 'Solidity',
    sources: { 'AvowRenewalEscrowV2.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = (output.errors || []).filter(error => error.severity === 'error')
  if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'))

  const compiled = output.contracts['AvowRenewalEscrowV2.sol'].AvowRenewalEscrowV2
  const artifact = {
    contractName: 'AvowRenewalEscrowV2',
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`,
  }
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true })
  await writeFile(
    new URL('../artifacts/AvowRenewalEscrowV2.json', import.meta.url),
    `${JSON.stringify(artifact, null, 2)}\n`,
  )
  return artifact
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const artifact = await compileEscrowV2()
  console.log(`ESCROW V2 COMPILE PASSED — ${artifact.abi.length} ABI entries.`)
}

