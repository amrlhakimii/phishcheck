import { describe, expect, it } from 'vitest'
import { analyze } from '../src/analyze'

const NOW = Date.parse('2026-10-24T03:00:00Z')
const mail = (headers: string[], body: string, html = false) =>
  headers.join('\r\n') + `\r\nContent-Type: text/${html ? 'html' : 'plain'}; charset=UTF-8\r\n\r\n${body}\r\n`
const base = (from: string, extra: string[] = []) => ['Date: Sat, 24 Oct 2026 02:00:00 +0000', `From: ${from}`, 'To: amirul@example.com', 'Message-ID: <abc123@mail.example>', 'MIME-Version: 1.0', ...extra]
const run = (raw: string) => {
  const r = analyze(raw, NOW)
  if (!r.ok) throw new Error('not parsed')
  return r
}

describe('department titles and third-party reply-to', () => {
  it('does not treat an HR mailbox with a payroll-vendor Reply-To as impersonation', () => {
    const r = run(mail(base('HR Team <hr@acme-corp.example>', ['Reply-To: support@payrollvendor.example', 'Authentication-Results: mx.example.com; dkim=pass header.d=acme-corp.example; spf=pass smtp.mailfrom=acme-corp.example; dmarc=pass header.from=acme-corp.example', 'Subject: Your payslip is ready']), '<p>Your October payslip is ready.</p><a href="https://portal.acme-corp.example/payslips">Open portal</a>', true))
    expect(r.findings.some((f) => f.check === 'C13')).toBe(false)
  })
  it('still flags an HR title on a free-mail address', () => {
    const r = run(mail(base('HR Department <hr.dept.office@gmail.com>', ['Subject: Salary review']), 'Please reply with your bank details for the salary review.'))
    expect(r.findings.some((f) => f.check === 'C13')).toBe(true)
  })
  it('still flags a CEO title with a different Reply-To organisation', () => {
    const r = run(mail(base('CEO Ahmad <ceo@company.example.test>', ['Reply-To: ahmad.private@elsewhere.test', 'Subject: Request']), 'Are you available? I need a quick favour.'))
    expect(r.findings.some((f) => f.check === 'C13')).toBe(true)
  })
})

describe('vendor bank-detail change scam', () => {
  const scam = mail(base('Accounts <accounts@vendor-billing.example.test>', ['Reply-To: payments@vendor-billing-update.test', 'Authentication-Results: mx.example.com; spf=pass smtp.mailfrom=vendor-billing.example.test; dkim=none; dmarc=none', 'Subject: Updated bank details for invoice 4471']), 'Please note our bank account has changed. Kindly update your records and pay the outstanding invoice to the new account number below. This is urgent, do not discuss with others.')
  it('matches both the bank-change and secrecy groups', () => {
    const r = run(scam)
    const c14 = r.findings.find((f) => f.check === 'C14')
    expect(c14).toBeDefined()
    expect(c14!.evidence).toMatch(/change of bank details/)
    expect(c14!.evidence).toMatch(/secrecy/)
  })
  it('is not reported as "No obvious red flags"', () => {
    const r = run(scam)
    expect(r.score.band).not.toBe('Looks fine')
    expect(r.score.score).toBeGreaterThanOrEqual(25)
  })
  it('does not fire on an authenticated invoice reminder with no pressure wording', () => {
    const r = run(mail(base('Billing <billing@vendor.example>', ['Authentication-Results: mx.example.com; dkim=pass header.d=vendor.example; spf=pass smtp.mailfrom=vendor.example; dmarc=pass header.from=vendor.example', 'Subject: Invoice 4471 due']), 'Invoice 4471 is due on 30 Nov. Pay using the bank details already on your account.'))
    expect(r.findings.some((f) => f.check === 'C14')).toBe(false)
  })
})
