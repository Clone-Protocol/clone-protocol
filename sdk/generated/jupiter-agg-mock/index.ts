import { PublicKey } from '@solana/web3.js'
export * from './accounts'
export * from './instructions'
export * from './types'

/**
 * Program address
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ADDRESS = 'B6jwZpUv7BC8Gzd5Ud5Y6FcjDFdfL4J7chmKXMig4mxY'

/**
 * Program public key
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ID = new PublicKey(PROGRAM_ADDRESS)
