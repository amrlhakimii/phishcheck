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
 * Defang any URL, domain, IP or email-looking text inside free text. Every dot between two
 * alphanumerics becomes "[.]", every "@" becomes "[@]" and schemes become hxxp[://].
 * Only single-character look-behind/ahead regexes are used, so it stays linear on long input.
 */
export function defangText(text: string, maxLen = 600): string {
  const t = text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  return t
    .replace(/\bhttp(s?):\/\//gi, (_m, s: string) => `hxxp${s}[://]`)
    .replace(/\b(hxxps?|ftp):\/\//gi, (_m, p: string) => `${p}[://]`)
    .replace(/@/g, '[@]')
    .replace(/([A-Za-z0-9_~-])\.(?=[A-Za-z0-9_~-])/g, '$1[.]')
}
