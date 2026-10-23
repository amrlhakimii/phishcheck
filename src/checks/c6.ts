import type { Context } from '../context'
import type { Finding } from '../types'
import { mk } from './util'

/** C6: link hygiene. One finding per flag type, listing affected links. */
export function c6(ctx: Context): Finding[] {
  const out: Finding[] = []
  const group = (_flag: string, pred: (l: (typeof ctx.links)[number]) => boolean) => ctx.links.filter(pred).slice(0, 5)
  const hosts = (ls: typeof ctx.links) => ls.map((l) => l.href.slice(0, 90)).join(' , ')
  const ip = group('ip', (l) => l.flags.includes('ip-host'))
  if (ip.length) out.push(mk({ check: 'C6', code: 'C6.ip_url', severity: 'medium', title: 'Link points to a raw IP address', evidence: hosts(ip),
    why: 'Legitimate organisations link to named websites. A bare IP address usually means a throwaway server.', action: 'Do not open it.' }))
  const ob = group('ob', (l) => l.flags.includes('ip-obfuscated'))
  if (ob.length) out.push(mk({ check: 'C6', code: 'C6.ip_obfuscated', severity: 'high', title: 'Link hides an IP address in decimal/hex/octal form', evidence: ob.map((l) => `${l.href.slice(0, 70)} (= ${l.ipNormalized ?? '?'})`).join(' , '),
    why: 'Numbers like 3232235777 or 0xC0A80001 are valid IP addresses that browsers will open. Only attackers write links this way.', action: 'Do not open it.' }))
  const ui = group('ui', (l) => l.flags.includes('userinfo'))
  if (ui.length) out.push(mk({ check: 'C6', code: 'C6.userinfo', severity: 'high', title: 'Link uses "@" to disguise its real host', evidence: hosts(ui),
    why: 'In a URL, everything before "@" is ignored username text. a link written as hxxps://bank[.]com[@]evil[.]test (defanged here) actually goes to evil[.]test.', action: 'Do not open it.' }))
  const sc = group('sc', (l) => l.flags.includes('data-url') || l.flags.includes('javascript-url'))
  if (sc.length) out.push(mk({ check: 'C6', code: 'C6.script_url', severity: 'high', title: 'Link uses a data: or javascript: URL', evidence: hosts(sc),
    why: 'These run or embed code instead of opening a website. They have no legitimate use in an email link.', action: 'Do not open it.' }))
  const sh = group('sh', (l) => l.flags.includes('shortener'))
  if (sh.length) out.push(mk({ check: 'C6', code: 'C6.shortener', severity: 'medium', title: 'URL shortener hides the destination', evidence: hosts(sh),
    why: 'Short links hide where you will land. Marketing mail uses them too (false positives possible).', action: 'Do not follow it unless you know and trust the sender.' }))
  const lg = group('lg', (l) => l.flags.includes('long-url') || l.flags.includes('encoded'))
  if (lg.length) out.push(mk({ check: 'C6', code: 'C6.long_encoded', severity: 'low', title: 'Very long or heavily encoded link', evidence: hosts(lg),
    why: 'Long, encoded links can hide the real target or carry tracking data. Common in marketing mail.', action: 'Prefer typing the site address yourself.' }))
  const ht = group('ht', (l) => l.flags.includes('http'))
  if (ht.length) out.push(mk({ check: 'C6', code: 'C6.http', severity: 'low', title: 'Link does not use HTTPS', evidence: hosts(ht),
    why: 'Plain http sends data unencrypted. Reputable sites have used https for years.', action: 'Never enter passwords on an http page.' }))
  return out
}
