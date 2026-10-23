import { Budget, LIMITS } from './limits'
import { type Header, getFirst, normalizeNewlines, parseHeaders, splitHeadBody } from './headers'
import { type Attachment, type TextPart, parseMimeBody } from './mime'

export type { Header } from './headers'
export type { Attachment, TextPart } from './mime'

export interface ParsedEmail {
  headers: Header[]
  texts: TextPart[]
  /** Best plain-text body: text/plain part, or a text extraction of HTML. */
  plain: string
  html: string
  attachments: Attachment[]
  warnings: string[]
  bytes: number
}

export type ParseOutcome =
  | { ok: true; email: ParsedEmail }
  | { ok: false; reason: 'empty' | 'too-large' | 'not-email'; message: string }

const KNOWN = new Set([
  'from', 'to', 'subject', 'date', 'message-id', 'received', 'return-path', 'reply-to', 'mime-version',
  'content-type', 'authentication-results', 'x-mailer', 'delivered-to', 'sender', 'received-spf', 'dkim-signature',
  'list-unsubscribe', 'cc', 'bcc', 'content-transfer-encoding',
])

export function looksLikeEmail(headers: Header[]): boolean {
  const known = new Set(headers.map((h) => h.key).filter((k) => KNOWN.has(k)))
  const hasCore = known.has('from') || known.has('received') || known.has('subject') || known.has('message-id')
  return hasCore && known.size >= 2
}

export function parseEmail(raw: string, budget: Budget = new Budget()): ParseOutcome {
  if (!raw || !raw.trim()) return { ok: false, reason: 'empty', message: 'Nothing to analyse yet.' }
  if (raw.length > LIMITS.maxInput) {
    return { ok: false, reason: 'too-large', message: `Input is larger than the ${LIMITS.maxInput / 1024 / 1024} MB limit.` }
  }
  const noBom = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const text = normalizeNewlines(noBom.replace(/^\s*\n/, ''))
  const { head, body } = splitHeadBody(text)
  const headers = parseHeaders(head)
  if (!looksLikeEmail(headers)) {
    return {
      ok: false,
      reason: 'not-email',
      message: "This doesn't look like raw email source (no recognisable headers such as From, Received or Subject).",
    }
  }
  const mime = parseMimeBody(headers, body, budget)
  const warnings = [...mime.warnings]
  if (mime.texts.length === 0 && body.trim()) {
    const m = getFirst(headers, 'content-type')
    if (!m) mime.texts.push({ contentType: 'text/plain', text: body.slice(0, LIMITS.maxPartBytes), truncated: false })
  }
  const plainParts = mime.texts.filter((t) => t.contentType === 'text/plain').map((t) => t.text)
  const htmlParts = mime.texts.filter((t) => t.contentType === 'text/html').map((t) => t.text)
  return {
    ok: true,
    email: {
      headers,
      texts: mime.texts,
      plain: plainParts.join('\n\n'),
      html: htmlParts.join('\n'),
      attachments: mime.attachments,
      warnings,
      bytes: raw.length,
    },
  }
}
