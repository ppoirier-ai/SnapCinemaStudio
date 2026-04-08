#!/usr/bin/env node
/**
 * Anchor uses sha256("global:<instruction_name>")[0..8] for instruction discriminators.
 * Compare output to IX.* in src/stakeToCurate/client.ts after program changes.
 */
const { createHash } = require('crypto')

const names = [
  'initialize_slot',
  'register_version',
  'stake_up',
  'stake_down',
  'unstake',
  'deposit_revenue',
  'claim_curator',
]

for (const n of names) {
  const h = createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
  console.log(n, Buffer.from(h).toString('hex'))
}
