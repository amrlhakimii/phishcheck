/** Defanging helpers: make indicators safe to paste into chat, tickets and reports. */

export function defangUrl(url: string): string {
  let u = url.trim()
  u = u.replace(/^h(t)(t)p(s?):\/\//i, (_m, _a, _b, s) => `hxxp${s}://`)
  // Defang the scheme separator and every dot/@ in the authority + rest.
  u = u.replace(/^(hxxps?|ftp|[a-z][a-z0-9+.-]*):\/\//i, (_m, s) => `${s}[://]`)
  return u.replace(/\./g, '[.]').replace(/@/g, '[@]')
}

export function defangDomain(d: string): string {
  return d.replace(/\./g, '[.]')
}

export function defangEmail(e: string): string {
  return e.replace(/@/g, '[@]').replace(/\./g, '[.]')
}

/**
 * Defang any URL, domain, IP or email-looking token inside free text.
 * Token based (no nested quantifiers) so it stays linear on long input.
 */
export function defangText(text: string, maxLen = 600): string {
  const t = text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  return t
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok
      if (/^h(t)tps?:\/\//i.test(tok) || /^(hxxps?|ftp):\/\//i.test(tok)) return defangUrl(tok)
      let out = tok.replace(/^h(t)tp(s?)\b/i, 'hxxp$2')
      out = out.replace(/@/g, '[@]')
      out = out.replace(/([A-Za-z0-9_~-])\.(?=[A-Za-z0-9_~-])/g, '$1[.]')
      return out
    })
    .join('')
}
