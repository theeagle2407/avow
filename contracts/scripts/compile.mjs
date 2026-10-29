import { mkdir, readFile, writeFile } from 'node:fs/promises'
import solc from 'solc'

export async function compileContract() {
  const source = await readFile(
    new URL('../src/AvowDecisionReceiver.sol', import.meta.url),
    'utf8',
  )

  const input = {
    language: 'Solidity',
    sources: { 'AvowDecisionReceiver.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = (output.errors ?? []).filter(error => error.severity === 'error')
  if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'))

  const compiled = output.contracts['AvowDecisionReceiver.sol'].AvowDecisionReceiver
  const artifact = {
    contractName: 'AvowDecisionReceiver',
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`,
  }

  const artifactUrl = new URL('../artifacts/AvowDecisionReceiver.json', import.meta.url)
  await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true })
  await writeFile(artifactUrl, `${JSON.stringify(artifact, null, 2)}\n`)
  return artifact
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const artifact = await compileContract()
  console.log(`COMPILE PASSED — ${artifact.abi.length} ABI entries; no deployment performed.`)
}
