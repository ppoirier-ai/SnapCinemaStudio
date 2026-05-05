/**
 * Waitlist signup (`POST` JSON body) and optional admin CSV-style listing (`op: list` with wallet
 * `signMessage` proof). Signups use optional Turnstile + Upstash rate limits
 * (`enforcePublicSignupGuards`). Requires Supabase service role env vars.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_PLATFORM_OWNER_PUBKEY } from '../src/config/defaultPlatformOwnerPubkey.js'
import { GENERIC_INTERNAL_ERROR, logServerError } from './lib/apiErrors.js'
import { applyApiCors, isCorsOriginAllowed } from './lib/cors.js'
import { enforcePublicSignupGuards } from './lib/enforcePublicSignupGuards.js'
import { parseVercelJsonBody } from './lib/parseVercelJsonBody.js'
import { PayloadTooLargeError } from './lib/requestLimits.js'
import {
  decodeBase58Ed25519Pubkey,
  ed25519PubkeyBytesEqual,
} from './lib/solanaPubkeyBytes.js'
import { verifySolanaWalletSignMessage } from './lib/verifySolanaWalletSignMessage.js'
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrlForServer,
} from './lib/supabaseServerEnv.js'

/**
 * Service client without generated `Database` types (mailing_list_signups lives only in SQL).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generic when schema not codegen'd
type ServiceDb = SupabaseClient<any, 'public', any>

const MAIL_LIST_ADMIN_MSG_RE =
  /^SnapCinema:mailing-list-admin:v1:([^:]+):(\d+):([0-9a-f-]{36})$/i

const MAX_EMAIL_LEN = 320
const MAX_TELEGRAM_LEN = 128
const LIST_LIMIT = 2000

function getPlatformOwnerPubkeyString(): string {
  return (
    process.env.PLATFORM_OWNER_PUBKEY?.trim() ||
    process.env.VITE_PLATFORM_OWNER_PUBKEY?.trim() ||
    DEFAULT_PLATFORM_OWNER_PUBKEY
  )
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

    if (body.op === 'list') {
      await handleList(res, supabase, body)
      return
    }

    if (!(await enforcePublicSignupGuards(req, res, body))) return

    await handleSignup(res, supabase, body)
  } catch (e) {
    logServerError('[mailing-list] unhandled', e)
    if (res.headersSent) return
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
  }
}

async function handleSignup(
  res: VercelResponse,
  supabase: ServiceDb,
  body: Record<string, unknown>,
) {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const rawTelegram =
    typeof body.telegram === 'string' ? body.telegram.trim() : ''
  const telegram = rawTelegram.replace(/^@+/, '')

  const intent = body.intent === 'watch' || body.intent === 'contribute' ? body.intent : null
  const source =
    body.source === 'landing' || body.source === 'watch' ? body.source : null

  if (!intent || !source) {
    res.status(400).json({
      error: 'intent (watch|contribute) and source (landing|watch) are required',
    })
    return
  }

  if (email.length === 0 && telegram.length === 0) {
    res.status(400).json({
      error: 'Provide at least one of email or Telegram',
    })
    return
  }

  if (email.length > MAX_EMAIL_LEN || telegram.length > MAX_TELEGRAM_LEN) {
    res.status(400).json({ error: 'Field too long' })
    return
  }

  const row = {
    email: email.length > 0 ? email : null,
    telegram: telegram.length > 0 ? telegram : null,
    intent,
    source,
  }

  const { error } = await supabase.from('mailing_list_signups').insert(row)

  if (error) {
    logServerError('[mailing-list] insert', error)
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
    return
  }

  res.status(200).json({ ok: true })
}

async function handleList(
  res: VercelResponse,
  supabase: ServiceDb,
  body: Record<string, unknown>,
) {
  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const sigB64 = typeof body.signature === 'string' ? body.signature : ''
  if (!wallet || !message || !sigB64) {
    res.status(400).json({ error: 'wallet, message, signature required' })
    return
  }

  const verified = await verifySolanaWalletSignMessage({
    wallet,
    message,
    signatureBase64: sigB64,
    messageRegex: MAIL_LIST_ADMIN_MSG_RE,
  })
  if (!verified.ok) {
    const status =
      verified.error === 'Signature verification failed' ? 401 : 400
    res.status(status).json({ error: verified.error })
    return
  }
  const walletBytes = verified.walletPubkeyBytes

  const ownerStr = getPlatformOwnerPubkeyString()
  const ownerBytes = decodeBase58Ed25519Pubkey(ownerStr)
  if (!ownerBytes) {
    res.status(500).json({ error: 'Invalid platform owner configuration' })
    return
  }
  if (!ed25519PubkeyBytesEqual(walletBytes, ownerBytes)) {
    res.status(403).json({ error: 'Not platform owner' })
    return
  }

  const { count, error: countErr } = await supabase
    .from('mailing_list_signups')
    .select('*', { count: 'exact', head: true })

  if (countErr) {
    logServerError('[mailing-list] count', countErr)
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
    return
  }

  const { data: rows, error: listErr } = await supabase
    .from('mailing_list_signups')
    .select('id, email, telegram, intent, source, created_at')
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT)

  if (listErr) {
    logServerError('[mailing-list] list', listErr)
    res.status(500).json({ error: GENERIC_INTERNAL_ERROR })
    return
  }

  res.status(200).json({
    total: count ?? 0,
    rows: rows ?? [],
  })
}
