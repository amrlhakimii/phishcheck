import type { ParsedEmail } from './parse'
import { getAll, getFirst, parseAddress, type Address } from './parse/headers'
import { scanHtml, type HtmlFacts } from './html'
import { extractLinks, type LinkInfo } from './links'
import { parseAuthResults, type AuthResult } from './auth'
import { parseReceivedChain, parseDate, type Hop } from './received'

export interface Context {
  email: ParsedEmail
  now: number
  subject: string
  from: Address | null
  returnPath: Address | null
  replyTo: Address | null
  sender: Address | null
  auth: AuthResult[]
  hops: Hop[]
  html: HtmlFacts | null
  /** Plain text used for display and wording checks (plain part, else text extracted from HTML). */
  bodyText: string
  links: LinkInfo[]
  dateMs: number | null
}

export function buildContext(email: ParsedEmail, now: number = Date.now()): Context {
  const h = email.headers
  const addr = (name: string) => {
    const v = getFirst(h, name)?.value
    return v ? parseAddress(v) : null
  }
  const html = email.html ? scanHtml(email.html) : null
  const bodyText = email.plain.trim() ? email.plain : (html?.text ?? '')
  const links = extractLinks(email.plain, email.html)
  const dateHeader = getAll(h, 'date')[0]
  return {
    email,
    now,
    subject: getFirst(h, 'subject')?.value ?? '',
    from: addr('from'),
    returnPath: addr('return-path'),
    replyTo: addr('reply-to'),
    sender: addr('sender'),
    auth: parseAuthResults(h),
    hops: parseReceivedChain(h),
    html,
    bodyText,
    links,
    dateMs: dateHeader ? parseDate(dateHeader.raw) : null,
  }
}
