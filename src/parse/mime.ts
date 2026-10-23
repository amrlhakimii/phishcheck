import { Budget, LIMITS } from './limits'
import { bytesToString, decodeBase64, decodeQuotedPrintable, stringToLatin1Bytes } from './decode'
import { type Header, getFirst, parseHeaders, parseParamHeader, splitHeadBody } from './headers'

export interface Attachment {
  filename: string
  contentType: string
  size: number
  /** Declared disposition: attachment | inline | '' */
  disposition: string
}

export interface TextPart {
  contentType: string
  text: string
  truncated: boolean
}

export interface MimeResult {
  texts: TextPart[]
  attachments: Attachment[]
  partCount: number
  maxDepth: number
  warnings: string[]
}

interface Ctx {
  result: MimeResult
  budget: Budget
  decodedTotal: number
}

/** Extract and validate a boundary parameter. Returns '' when absent. */
function boundaryOf(ctype: ReturnType<typeof parseParamHeader>): string {
  const b = ctype.params['boundary'] ?? ''
  return b.length > 0 && b.length <= 200 ? b : ''
}

/** Split a multipart body on its boundary using indexOf (linear, no regex). */
export function splitMultipart(body: string, boundary: string, maxParts: number): string[] {
  const delim = '--' + boundary
  const parts: string[] = []
  let pos = 0
  // Find first delimiter at the start of a line.
  const isLineStart = (i: number) => i === 0 || body[i - 1] === '\n'
  let first = -1
  while (pos <= body.length) {
    const i = body.indexOf(delim, pos)
    if (i < 0) break
    if (isLineStart(i)) { first = i; break }
    pos = i + delim.length
  }
  if (first < 0) return []
  let cursor = first + delim.length
  for (;;) {
    // rest of delimiter line
    const eol = body.indexOf('\n', cursor)
    if (eol < 0) break
    if (body.slice(cursor, eol).startsWith('--')) break // closing delimiter
    const start = eol + 1
    // find next delimiter at line start
    let search = start
    let next = -1
    while (search <= body.length) {
      const j = body.indexOf(delim, search)
      if (j < 0) break
      if (isLineStart(j)) { next = j; break }
      search = j + delim.length
    }
    if (next < 0) {
      parts.push(body.slice(start)) // unterminated final part
      break
    }
    parts.push(body.slice(start, next > start ? next - 1 : next)) // drop the newline before delimiter
    if (parts.length >= maxParts) break
    cursor = next + delim.length
  }
  return parts
}

function decodeBody(body: string, cte: string, charset: string, ctx: Ctx): { text: string; truncated: boolean; size: number } {
  const room = Math.max(0, Math.min(LIMITS.maxPartBytes, LIMITS.maxTotalDecoded - ctx.decodedTotal))
  let bytes: Uint8Array
  const enc = cte.trim().toLowerCase()
  if (enc === 'base64') bytes = decodeBase64(body, room + 1)
  else if (enc === 'quoted-printable') bytes = decodeQuotedPrintable(body, false, room + 1)
  else bytes = stringToLatin1Bytes(body.length > room + 1 ? body.slice(0, room + 1) : body)
  const truncated = bytes.length > room
  if (truncated) bytes = bytes.slice(0, room)
  ctx.decodedTotal += bytes.length
  let text: string
  if (enc === '7bit' || enc === '8bit' || enc === 'binary' || enc === '') {
    // Raw text pasted as a JS string is already unicode; do not re-decode latin1 bytes.
    text = body.length > room ? body.slice(0, room) : body
  } else {
    text = bytesToString(bytes, charset)
  }
  const approxSize = enc === 'base64' ? Math.floor((body.length * 3) / 4) : body.length
  return { text, truncated, size: approxSize }
}

function walk(entity: string, parentType: string, depth: number, ctx: Ctx, inheritedHeaders?: Header[]): void {
  const { result, budget } = ctx
  result.maxDepth = Math.max(result.maxDepth, depth)
  if (budget.check()) return
  if (result.partCount >= LIMITS.maxParts) return
  result.partCount++

  let headers: Header[]
  let body: string
  if (inheritedHeaders) {
    headers = inheritedHeaders
    body = entity
  } else {
    const hb = splitHeadBody(entity)
    headers = parseHeaders(hb.head)
    body = hb.body
  }
  const ctype = parseParamHeader(getFirst(headers, 'content-type')?.raw ?? (parentType === 'multipart/digest' ? 'message/rfc822' : 'text/plain'))
  const type = ctype.value || 'text/plain'
  const cte = getFirst(headers, 'content-transfer-encoding')?.raw ?? ''
  const disp = parseParamHeader(getFirst(headers, 'content-disposition')?.raw ?? '')
  const filename = disp.params['filename'] ?? ctype.params['name'] ?? ''

  if (type.startsWith('multipart/')) {
    if (depth >= LIMITS.maxMimeDepth) {
      result.warnings.push(`MIME nesting deeper than ${LIMITS.maxMimeDepth} levels was not parsed.`)
      return
    }
    const boundary = boundaryOf(ctype)
    if (!boundary) {
      result.warnings.push('Multipart message has no usable boundary; treated the body as plain text.')
      const d = decodeBody(body, cte, ctype.params['charset'] ?? 'utf-8', ctx)
      result.texts.push({ contentType: 'text/plain', text: d.text, truncated: d.truncated })
      return
    }
    const parts = splitMultipart(body, boundary, LIMITS.maxParts)
    if (parts.length === 0) {
      result.warnings.push('Multipart boundary was declared but never found in the body.')
      const d = decodeBody(body, cte, ctype.params['charset'] ?? 'utf-8', ctx)
      result.texts.push({ contentType: 'text/plain', text: d.text, truncated: d.truncated })
      return
    }
    for (const p of parts) {
      if (result.partCount >= LIMITS.maxParts) {
        result.warnings.push(`More than ${LIMITS.maxParts} MIME parts; the rest were skipped.`)
        break
      }
      walk(p, type, depth + 1, ctx)
    }
    return
  }

  if (type === 'message/rfc822' && !filename) {
    if (depth >= LIMITS.maxMimeDepth) return
    walk(body, type, depth + 1, ctx)
    return
  }

  const isAttachment = disp.value === 'attachment' || !!filename || !(type.startsWith('text/'))
  if (isAttachment) {
    const approx = cte.trim().toLowerCase() === 'base64' ? Math.floor((body.length * 3) / 4) : body.length
    result.attachments.push({
      filename: filename.slice(0, 255),
      contentType: type,
      size: approx,
      disposition: disp.value,
    })
    return
  }
  if (type === 'text/plain' || type === 'text/html') {
    const d = decodeBody(body, cte, ctype.params['charset'] ?? 'utf-8', ctx)
    if (d.truncated) result.warnings.push(`A ${type} part was larger than ${LIMITS.maxPartBytes / 1024} KB and was truncated.`)
    result.texts.push({ contentType: type, text: d.text, truncated: d.truncated })
  } else if (type.startsWith('text/')) {
    result.attachments.push({ filename: filename.slice(0, 255), contentType: type, size: body.length, disposition: disp.value })
  }
}

export function parseMimeBody(headers: Header[], body: string, budget: Budget): MimeResult {
  const result: MimeResult = { texts: [], attachments: [], partCount: 0, maxDepth: 0, warnings: [] }
  const ctx: Ctx = { result, budget, decodedTotal: 0 }
  walk(body, '', 0, ctx, headers)
  if (budget.expired) result.warnings.push('Analysis time limit reached; results may be incomplete.')
  return result
}
