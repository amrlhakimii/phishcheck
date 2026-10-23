import { describe, expect, it } from 'vitest'
import { BASE_HEADERS, codes, findingsOf, mail } from './helpers'
import { checkDomain } from '../src/checks/c4'

const H = (extra: Record<string, string> = {}) => ({ ...BASE_HEADERS, ...extra })
const html = (body: string, extra: Record<string, string> = {}) => mail(H({ 'Content-Type': 'text/html; charset=utf-8', ...extra }), body)
const text = (body: string, extra: Record<string, string> = {}) => mail(H(extra), body)

describe('C1 authentication results', () => {
  const ar = (v: string) => text('hi', { 'Authentication-Results': v })
  it('flags SPF, DKIM and DMARC failures', () => {
    const c = codes(ar('mx.example.net; spf=fail smtp.mailfrom=x.example.org; dkim=fail header.d=example.com; dmarc=fail header.from=example.com'))
    expect(c).toEqual(expect.arrayContaining(['C1.spf_fail', 'C1.dkim_fail', 'C1.dmarc_fail']))
  })
  it('flags softfail', () => {
    expect(codes(ar('mx; spf=softfail smtp.mailfrom=a@example.com'))).toContain('C1.spf_softfail')
  })
  it('does not flag passes or none', () => {
    const c = codes(ar('mx; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com'))
    expect(c.filter((x) => x.startsWith('C1.'))).toEqual([])
    expect(codes(ar('mx; dkim=none')).filter((x) => x.startsWith('C1.'))).toEqual([])
  })
  it('notes missing authentication headers (low) and reads Received-SPF fallback', () => {
    expect(codes(text('hi'))).toContain('C1.missing')
    expect(codes(text('hi', { 'Received-SPF': 'fail (example.com: domain does not designate) client-ip=203.0.113.9' }))).toContain('C1.spf_fail')
  })
  it('ignores method names inside comments', () => {
    expect(codes(ar('mx; spf=pass (spf=fail would be bad) smtp.mailfrom=example.com')).includes('C1.spf_fail')).toBe(false)
  })
})

describe('C2 sender mismatch', () => {
  it('flags Reply-To and Return-Path on other organisations', () => {
    const c = codes(text('hi', { 'Reply-To': 'x@example.org', 'Return-Path': '<b@example.net>' }))
    expect(c).toEqual(expect.arrayContaining(['C2.replyto_mismatch', 'C2.returnpath_mismatch']))
  })
  it('accepts same organisation subdomains and absent headers', () => {
    const c = codes(text('hi', { 'Reply-To': 'x@support.example.com', 'Return-Path': '<b@bounce.mail.example.com>' }))
    expect(c.filter((x) => x.startsWith('C2.'))).toEqual([])
    expect(codes(text('hi')).filter((x) => x.startsWith('C2.'))).toEqual([])
  })
})

describe('C3 display-name spoofing', () => {
  it('flags an email address in the display name pointing elsewhere', () => {
    expect(codes(text('hi', { From: '"support@paypal.com" <x@example.org>' }))).toContain('C3.address_in_name')
  })
  it('flags brand in display name with unrelated domain', () => {
    expect(codes(text('hi', { From: 'Maybank Security <alert@example.org>' }))).toContain('C3.brand_in_name')
    expect(codes(text('hi', { From: 'PayPal Support <help@example.net>' }))).toContain('C3.brand_in_name')
  })
  it('does not flag the real brand domain or ordinary names', () => {
    expect(codes(text('hi', { From: 'PayPal <service@paypal.com>' })).filter((x) => x.startsWith('C3.'))).toEqual([])
    expect(codes(text('hi', { From: 'Alice Tan <alice@example.com>' })).filter((x) => x.startsWith('C3.'))).toEqual([])
    expect(codes(text('hi', { From: '"alice@example.com" <alice@example.com>' })).filter((x) => x.startsWith('C3.'))).toEqual([])
  })
  it('does not trigger on words that merely contain a short brand token', () => {
    expect(codes(text('hi', { From: 'Grabbing Hands Bakery <hi@example.com>' })).filter((x) => x.startsWith('C3.'))).toEqual([])
  })
})

describe('C4 lookalike domains', () => {
  it.each(['paypa1.com', 'rnicrosoft.com', 'xn--pypal-4ve.com', 'g00gle.com'])('flags %s', (h) => {
    expect(checkDomain(h, 'From').length, h).toBeGreaterThan(0)
  })
  it.each(['paypal.com', 'microsoft.com', 'www.google.com', 'maybank2u.com.my', 'example.com'])('keeps %s clean', (h) => {
    expect(checkDomain(h, 'From')).toEqual([])
  })
  it('flags punycode, suspicious TLDs and excessive subdomains', () => {
    expect(checkDomain('xn--bcher-kva.example', 'link').map((f) => f.code)).toContain('C4.punycode')
    expect(checkDomain('free-gift.xyz', 'link').map((f) => f.code)).toContain('C4.suspicious_tld')
    expect(checkDomain('a.b.c.d.e.example.org', 'link').map((f) => f.code)).toContain('C4.many_subdomains')
  })
  it('does not flag reserved test TLDs', () => {
    expect(checkDomain('mail.example.test', 'From')).toEqual([])
    expect(checkDomain('host.invalid', 'From')).toEqual([])
  })
  it('applies to sender and link hosts in a message', () => {
    expect(codes(text('see https://paypa1.com/login', { From: 'x <a@rnicrosoft.com>' })).filter((c) => c === 'C4.homoglyph').length).toBe(2)
  })
})

describe('C5 link mismatch', () => {
  it('flags www.bank.com text pointing elsewhere', () => {
    const f = findingsOf(html('<a href="http://evil.test/x">www.bank.com</a>'))
    const m = f.find((x) => x.code === 'C5.mismatch')
    expect(m).toBeTruthy()
    expect(m?.evidence).not.toMatch(/http|evil\.test/) // defanged
  })
  it('stays quiet for consistent links', () => {
    expect(codes(html('<a href="https://www.bank.com/login">www.bank.com</a>'))).not.toContain('C5.mismatch')
    expect(codes(html('<a href="https://www.bank.com/login">Log in</a>'))).not.toContain('C5.mismatch')
  })
})

describe('C6 link hygiene', () => {
  it('flags each hygiene problem', () => {
    expect(codes(text('open http://203.0.113.9/login'))).toEqual(expect.arrayContaining(['C6.ip_url', 'C6.http']))
    expect(codes(text('open https://3405803785/x'))).toContain('C6.ip_obfuscated')
    expect(codes(text('open https://www.example.com@evil.test/'))).toContain('C6.userinfo')
    expect(codes(text('open https://bit.ly/3abc'))).toContain('C6.shortener')
    expect(codes(html('<a href="javascript:alert(1)">x</a>'))).toContain('C6.script_url')
    expect(codes(text('open https://example.com/' + 'a'.repeat(250)))).toContain('C6.long_encoded')
  })
  it('leaves clean https links alone', () => {
    expect(codes(text('open https://www.example.com/page')).filter((c) => c.startsWith('C6.'))).toEqual([])
  })
})

describe('C7 urgency wording (EN + BM)', () => {
  it('tiers by number of phrases', () => {
    expect(codes(text('Please act now'))).toContain('C7.urgency_few')
    expect(codes(text('Final notice: act now or your account suspended'))).toContain('C7.urgency_some')
    expect(codes(text('urgent act now final notice account suspended verify within 24 hours congratulations'))).toContain('C7.urgency_many')
  })
  it('detects Bahasa Malaysia', () => {
    expect(codes(text('Tindakan segera diperlukan. Akaun anda akan digantung.'))).toContain('C7.urgency_some')
    expect(codes(text('Tahniah, tuntut hadiah anda'))).toContain('C7.urgency_few')
  })
  it('ignores calm wording', () => {
    expect(codes(text('Hi Bob, the meeting notes are attached. Thanks, Alice.')).filter((c) => c.startsWith('C7.'))).toEqual([])
  })
})

describe('C8 credential and payment requests', () => {
  it('flags credential requests in EN and BM', () => {
    expect(codes(text('Please confirm your password and card number'))).toContain('C8.credentials')
    expect(codes(text('Sila masukkan kata laluan dan nombor TAC anda'))).toContain('C8.credentials')
    expect(codes(text('Reply with the OTP we sent'))).toContain('C8.credentials')
  })
  it('flags payment pushes', () => {
    expect(codes(text('Please make a wire transfer today'))).toContain('C8.payment')
  })
  it('does not trigger on innocent text or on letters inside words', () => {
    expect(codes(text('Lunch at noon? The hotpot place has a great pot.')).filter((c) => c.startsWith('C8.'))).toEqual([])
    expect(codes(text('the otpion list')).filter((c) => c === 'C8.credentials')).toEqual([])
  })
})

describe('C9 attachment risk', () => {
  const att = (name: string, type = 'application/octet-stream') =>
    mail(H({ 'Content-Type': 'multipart/mixed; boundary=b' }), `--b\nContent-Type: text/plain\n\nhi\n--b\nContent-Type: ${type}; name="${name}"\nContent-Disposition: attachment; filename="${name}"\nContent-Transfer-Encoding: base64\n\nQUJD\n--b--\n`)
  it.each([
    ['invoice.pdf.exe', 'C9.double_ext'],
    ['report.doc.js', 'C9.double_ext'],
    ['setup.exe', 'C9.executable'],
    ['run.vbs', 'C9.executable'],
    ['login.html', 'C9.html_attach'],
    ['form.htm', 'C9.html_attach'],
    ['budget.xlsm', 'C9.macro'],
    ['disc.iso', 'C9.disk_image'],
    ['shortcut.lnk', 'C9.disk_image'],
    ['files.zip', 'C9.disk_image'],
  ])('flags %s as %s', (name, code) => {
    expect(codes(att(name))).toContain(code)
  })
  it.each(['report.pdf', 'photo.jpg', 'notes.txt', 'budget.xlsx', 'letter.docx'])('accepts %s', (name) => {
    expect(codes(att(name)).filter((c) => c.startsWith('C9.'))).toEqual([])
  })
  it('notes passwords given for archives', () => {
    const raw = att('files.zip').replace('hi\n', 'The password is 1234\n')
    expect(codes(raw)).toContain('C9.archive_password')
  })
})

describe('C10 header anomalies', () => {
  it('flags missing Message-ID, bad dates, backwards Received', () => {
    const noId = mail({ From: 'a@example.com', Subject: 's', Date: 'Sat, 24 Oct 2026 10:00:00 +0000', Received: 'from a by b; Sat, 24 Oct 2026 10:00:01 +0000' }, 'hi')
    expect(codes(noId)).toContain('C10.no_message_id')
    expect(codes(text('hi', { Date: 'Mon, 01 Jan 2035 00:00:00 +0000' }))).toContain('C10.bad_date')
    expect(codes(text('hi', { Date: 'garbage' }))).toContain('C10.bad_date')
    const back = mail(H({}), 'hi').replace('Subject', 'Received: from a by b; Sat, 24 Oct 2026 09:00:00 +0000\nReceived: from c by d; Sat, 24 Oct 2026 10:00:00 +0000\nSubject')
    expect(codes(back)).toContain('C10.received_order')
  })
  it('flags very long hop delays', () => {
    const raw = mail(H({}), 'hi').replace('Subject', 'Received: from a by b; Sat, 24 Oct 2026 10:00:00 +0000\nReceived: from c by d; Thu, 22 Oct 2026 10:00:00 +0000\nSubject')
    expect(codes(raw)).toContain('C10.received_delay')
  })
  it('accepts a normal header set', () => {
    const raw = mail(H({}), 'hi').replace('Subject', 'Received: from a by b; Sat, 24 Oct 2026 10:00:02 +0000\nReceived: from c by d; Sat, 24 Oct 2026 10:00:00 +0000\nSubject')
    expect(codes(raw).filter((c) => c.startsWith('C10.'))).toEqual([])
  })
})

describe('C11 tracking and hidden content', () => {
  it('flags 1x1 images and hidden text', () => {
    expect(codes(html('<img src="http://t.example.test/p.gif" width="1" height="1">'))).toContain('C11.pixel')
    expect(codes(html('<p style="font-size:0">buy cheap pills</p>'))).toContain('C11.hidden_text')
    expect(codes(html('<p style="color:#ffffff;background-color:#ffffff">x</p>'))).toContain('C11.hidden_text')
    const many = Array.from({ length: 12 }, (_, i) => `<img src="https://i.example.test/${i}.png" width=200 height=100>`).join('')
    expect(codes(html(many))).toContain('C11.many_images')
  })
  it('accepts ordinary html', () => {
    expect(codes(html('<p>Hello</p><img src="https://i.example.test/logo.png" width="200" height="50">')).filter((c) => c.startsWith('C11.'))).toEqual([])
  })
})

describe('C12 positive signals', () => {
  const good = text('hi', {
    'Authentication-Results': 'mx; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com',
    'Return-Path': '<bounce@example.com>',
  })
  it('credits aligned passes and consistent domains', () => {
    expect(codes(good)).toEqual(expect.arrayContaining(['C12.all_pass', 'C12.consistent']))
  })
  it('does not credit passes for a different domain', () => {
    const c = codes(text('hi', { 'Authentication-Results': 'mx; spf=pass smtp.mailfrom=other.example.org; dkim=pass header.d=other.example.org; dmarc=pass header.from=example.com' }))
    expect(c).not.toContain('C12.all_pass')
  })
  it('suppresses good signs when a high-severity finding exists', () => {
    const c = codes(html('<a href="http://evil.test">www.bank.com</a>', {
      'Authentication-Results': 'mx; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com',
      'Return-Path': '<bounce@example.com>',
    }))
    expect(c).toContain('C5.mismatch')
    expect(c.filter((x) => x.startsWith('C12.'))).toEqual([])
  })
  it('gives nothing when authentication failed', () => {
    const c = codes(text('hi', { 'Authentication-Results': 'mx; spf=fail smtp.mailfrom=example.com; dkim=pass header.d=example.com' }))
    expect(c.filter((x) => x.startsWith('C12.'))).toEqual([])
  })
})
