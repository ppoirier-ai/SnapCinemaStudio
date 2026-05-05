/**
 * Alpha priority registration ($SNAP): anonymous `POST` with email + Solana wallet. Uses optional
 * Turnstile + Upstash rate limits. Requires Supabase service role env vars.
 */
import { PublicKey } from '@solana/web3.js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GENERIC_INTERNAL_ERROR, logServerError } from './lib/apiErrors.js'
import { applyApiCors, isCorsOriginAllowed } from './lib/cors.js'
import { enforcePublicSignupGuards } from './lib/enforcePublicSignupGuards.js'
import { parseVercelJsonBody } from './lib/parseVercelJsonBody.js'
import { PayloadTooLargeError } from './lib/requestLimits.js'
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrlForServer,
} from './lib/supabaseServerEnv.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generic when schema not codegen'd
type ServiceDb = SupabaseClient<any, 'public', any>

const MAX_EMAIL_LEN = 320
const MAX_WALLET_LEN = 64

function parseSolanaPubkey(s: string): string | null {
  const t = s.trim()
  if (!t || t.length > MAX_WALLET_LEN) return null
  try {
    return new PublicKey(t).toBase58()
  } catch {
    return null
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    applyApiCors(req, res, 'POST, OPTIONS')
    if (req.method === 'OPTIONS') {
      if (!isCorsOriginAllowed(req)) {
        res.status(403).end()
        return
      }
      res.status(204).end()
      return
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS')
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const supabaseUrl = getSupabaseUrlForServer()
    const serviceKey = getSupabaseServiceRoleKey()

    if (!supabaseUrl || !serviceKey) {
      res.status(503).json({
        error:
          'Server missing Supabase URL or service key (e.g. SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY)',
      })
      return
    }

    const supabase: ServiceDb = createClient(supabaseUrl, serviceKey)
    let body: Record<string, unknown>
    try {
      body = parseVercelJsonBody(req)
    } catch (e) {
      if (e instanceof PayloadTooLargeError) {
        res.status(413).json({ error: 'Request body too large' })
        return
      }
      throw e
    }

    if (!(await enforcePublicSignupGuards(req, res, body))) return

    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const walletRaw =
      typeof body.wallet_address === 'string' ? body.wallet_address.trim() : ''
    const source =
      body.source === 'landing' || body.source === 'watch' ? body.source : null

    if (!source) {
      res.status(400).json({
        error: 'source (landing|watch) is required',
      })
      return
    }

    if (!email || !walletRaw) {
      res.status(400).json({
        error: 'email and wallet_address are required',
      })
      return
    }

    if (email.length > MAX_EMAIL_LEN) {
      res.status(400).json({ error: 'Email too long' })
      return
    }

    const walletNorm = parseSolanaPubkey(walletRaw)
    if (!walletNorm) {
      res.status(400).json({ error: 'Invalid Solana wallet address' })
      return
    }

    const row = {
      email,
      wallet_address: walletNorm,
      source,
    }

    const { error } = await supabase.from('snap_alpha_priority_registrations').insert(row)

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({
          error: 'This wallet is already registered for alpha priority access.',
        })
        return
      }
      logServerError('[snap-alpha-priority] insert', error)
      res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
      return
    }

    res.status(200).json({ ok: true })
  } catch (e) {
    logServerError('[snap-alpha-priority] unhandled', e)
    if (res.headersSent) return
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
  }
}
