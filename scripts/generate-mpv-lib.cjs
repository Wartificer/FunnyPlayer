// Generates mpv.lib from libmpv-2.dll for MSVC linking
// Uses dumpbin (from Visual Studio) to extract exports

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const depsDir = path.join(__dirname, '..', 'deps', 'mpv', 'lib')
const dllPath = path.join(depsDir, 'libmpv-2.dll')
const defPath = path.join(depsDir, 'mpv.def')
const libPath = path.join(depsDir, 'mpv.lib')

if (fs.existsSync(libPath)) {
  console.log('mpv.lib already exists, skipping.')
  process.exit(0)
}

if (!fs.existsSync(dllPath)) {
  console.error('libmpv-2.dll not found at', dllPath)
  process.exit(1)
}

console.log('Extracting exports from libmpv-2.dll...')

// Use dumpbin to get exports
let dumpOutput
try {
  dumpOutput = execSync(`dumpbin /exports "${dllPath}"`, { encoding: 'utf8' })
} catch (e) {
  console.error('dumpbin failed. Make sure you are running from a "Developer Command Prompt for VS".')
  console.error('Or run: "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\Tools\\VsDevCmd.bat" first.')
  process.exit(1)
}

// Parse export names from dumpbin output
// Lines look like:  "   1    0 0001A3B0 mpv_abort_async_command"
const symbols = []
for (const line of dumpOutput.split('\n')) {
  const match = line.match(/^\s+\d+\s+[0-9A-F]+\s+[0-9A-F]+\s+(\S+)/)
  if (match) {
    symbols.push(match[1])
  }
}

if (symbols.length === 0) {
  console.error('No exports found in DLL!')
  process.exit(1)
}

console.log(`Found ${symbols.length} exports.`)

// Write .def file
const defContent = `LIBRARY libmpv-2\nEXPORTS\n${symbols.map(e => `    ${e}`).join('\n')}\n`
fs.writeFileSync(defPath, defContent)
console.log(`Wrote ${defPath}`)

// Generate .lib
try {
  execSync(`lib /DEF:"${defPath}" /OUT:"${libPath}" /MACHINE:X64`, { stdio: 'inherit' })
  console.log(`Generated ${libPath} successfully.`)
} catch {
  console.error('lib.exe failed. Make sure you are running from a Developer Command Prompt.')
  process.exit(1)
}
