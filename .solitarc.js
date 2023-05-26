const path = require('path');
const toml = require('toml');
const fs = require('fs');

const moduleFromEnv = () => {
  const homedir = require('os').homedir();
  const programDirectory = process.env.PROGRAM_DIR

  const programDir = path.join(__dirname, '..', 'incept-protocol', 'programs', programDirectory);
  const idlDir = path.join(__dirname, 'target', 'idl');
  const sdkDir = path.join(__dirname, 'sdk', 'generated', programDirectory);
  const binaryInstallDir = `${homedir}/.cargo`;
  const removeExistingIdl = false;

  const programId = (() => {
    const altName = programDirectory.replaceAll('-', '_')
    const anchorToml = toml.parse(fs.readFileSync('./Anchor.toml', 'utf-8'));
    const tomlId = anchorToml.programs.localnet[altName]
    if (tomlId) return tomlId
    throw new Error(`Unrecognized program directory: ${programDirectory}`)
  })()

  return {
    idlGenerator: 'anchor',
    programName: programDirectory.replaceAll('-', '_'),
    programId,
    idlDir,
    sdkDir,
    binaryInstallDir,
    programDir,
    removeExistingIdl
  }
}

module.exports = moduleFromEnv();

// module.exports = {
//   idlGenerator: 'anchor',
//   programName: 'incept_comet_manager',
//   programId: '6HAQXsz7ScT5SueXukgDB8ExE9FKeqj5q1z925SujZsu',
//   idlDir,
//   sdkDir,
//   binaryInstallDir,
//   programDir,
//   removeExistingIdl
// };