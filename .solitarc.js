const path = require('path');

const moduleFromEnv = () => {
  const programDirectory = process.env.PROGRAM_DIR

  const programDir = path.join(__dirname, '..', 'incept-protocol', 'programs', programDirectory);
  const idlDir = path.join(__dirname, 'target', 'idl');
  const sdkDir = path.join(__dirname, 'sdk', 'generated', programDirectory);
  const binaryInstallDir = '.cargo';
  const removeExistingIdl = false;

  const programId = (() => {
    switch (programDirectory) {
      default:
        throw new Error(`Unrecognized program directory: ${programDirectory}`)
      case 'incept':
        return '5k28XzdwaWVXaWBwfm4ZFXQAnBaTfzu25k1sHatsnsL1'
      case 'incept-comet-manager':
        return '6HAQXsz7ScT5SueXukgDB8ExE9FKeqj5q1z925SujZsu'
      case 'pyth':
        return 'EERmAuBdXCAZitXKg1E2GaxFtwWDjZSctXKCvuWT19ki'
      case 'jupiter-agg-mock':
        return '4tChJFNsWLMyk81ezv8N8gKVb2q7H1akSQENn4NToSuS'
    }
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