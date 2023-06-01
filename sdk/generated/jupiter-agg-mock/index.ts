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
export const PROGRAM_ADDRESS = '6LHFDGiQtKZKdq1Gn8TnaQfxr4VYLTGHfJRxffQwVKpa'

/**
 * Program public key
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ID = new PublicKey(PROGRAM_ADDRESS)
