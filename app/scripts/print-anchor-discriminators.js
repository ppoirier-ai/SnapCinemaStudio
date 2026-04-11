#!/usr/bin/env node
/**
 * Anchor uses sha256("global:<instruction_name>")[0..8] for instruction discriminators.
 * Compare output to IX.* in src/stakeToCurate/client.ts after program changes.
 */
const { createHash } = require('crypto')

const names = [
  'initialize_slot',
  'register_scene',
  'stake_scene_up',
  'stake_scene_down',
  'unstake_scene',
  'reset_scene_rank',
]

for (const n of names) {
  const h = createHash('sha256').update(`global:${n}`).digest().subarray(0, 8)
  console.log(n, Buffer.from(h).toString('hex'))
}
