import { PublicKey } from '@solana/web3.js'
export * from './instructions'
export * from './types'

/**
 * Program address
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ADDRESS = 'H38XT5NKW9g9sZpmjwDQkp6S3nLTfg7tZ4WbAfgk7ZCG'

/**
 * Program public key
 *
 * @category constants
 * @category generated
 */
export const PROGRAM_ID = new PublicKey(PROGRAM_ADDRESS)
