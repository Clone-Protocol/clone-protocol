export * from './Clone'
export * from './Oracles'
export * from './Pools'
export * from './User'

import { Clone } from './Clone'
import { Pools } from './Pools'
import { Oracles } from './Oracles'
import { User } from './User'

export const accountProviders = { Clone, Pools, Oracles, User }
