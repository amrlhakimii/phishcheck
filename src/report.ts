import type { AnalysisResult } from './analyze'
import { defangDomain, defangEmail, defangText } from './ioc'
import type { Finding, Severity } from './types'

const ORDER: Severity[] = ['high', 'medium', 'low', 'info', 'good']
const HEAD: Record<Severity, string> = { high: 'High severity', medium: 'Medium severity', low: 'Low severity', info: 'Information', good: 'Good signs' }

/** Everything that leaves this function is defanged: no live URL, domain, IP or email appears. */
export function buildIocs(r: AnalysisResult): { domains: string[]; urls: string[]; ips: string[]; emails: string[]; attachments: string[] } {
  const ctx = r.ctx
  const domains = new Set<string>()
  const emails = new Set<string>()
  for (const a of [ctx.from, ctx.replyTo, ctx.returnPath, ctx.sender]) {
    if (a?.domain) domains.add(defangDomain(a.domain))
    if (a?.address && a.address.includes('@')) emails.add(defangEmail(a.address))
  }
  const urls = new Set<string>()
  const ips = new Set<string>()
  for (const l of ctx.links) {
    urls.add(l.defanged)
    if (l.host && l.hostKind === 'domain') domains.add(defangDomain(l.host))
    if (l.ipNormalized) ips.add(defangDomain(l.ipNormalized))
  }
  for (const h of ctx.hops) for (const ip of h.ips) ips.add(defangDomain(ip))
  const attachments = r.email.attachments.map((a) => defangText(`${a.filename || '(unnamed)'} (${a.contentType})`, 200))
  return { domains: [...domains], urls: [...urls], ips: [...ips], emails: [...emails], attachments }
}

function renderFinding(f: Finding): string {
  const sign = f.points > 0 ? `+${f.points}` : `${f.points}`
  return [
    `- **${f.title}** (${f.check}, ${sign} pts)`,
    `  - Seen: ${f.evidence}`,
    `  - Why it matters: ${f.why}`,
    `  - What to do: ${f.action}`,
  ].join('\n')
}

export function buildReport(r: AnalysisResult): string {
  const { score } = r
  const lines: string[] = []
  lines.push('# PhishCheck report', '')
  lines.push('> PhishCheck reports indicators and a heuristic score. It is not a guarantee that a message is safe or malicious. For a real incident, report it through your organisation\'s process.', '')
  lines.push(`**Verdict:** ${score.band.label}`, `**Score:** ${score.score}/100`, '')
  lines.push(score.band.blurb, '')
  if (score.floorReason) lines.push(`*Verdict floor applied: the numeric score is ${score.score}, but the verdict is raised to "${score.band.label}" because ${score.floorReason}.*`, '')
  if (score.topReasons.length) {
    lines.push('## Top reasons', '')
    score.topReasons.forEach((f, i) => lines.push(`${i + 1}. ${f.title}`))
    lines.push('')
  }
  lines.push('## Findings', '')
  if (r.findings.length === 0) lines.push('No indicators found.', '')
  for (const sev of ORDER) {
    const group = r.findings.filter((f) => f.severity === sev)
    if (!group.length) continue
    lines.push(`### ${HEAD[sev]}`, '', ...group.map(renderFinding), '')
  }
  const ioc = buildIocs(r)
  lines.push('## Indicators of compromise (defanged)', '', 'All values below are defanged and safe to paste. Do not re-fang them to browse.', '')
  const sect = (title: string, items: string[]) => {
    if (!items.length) return
    lines.push(`### ${title}`, '', ...items.map((i) => `- \`${i}\``), '')
  }
  sect('Domains', ioc.domains)
  sect('URLs', ioc.urls)
  sect('IP addresses', ioc.ips)
  sect('Email addresses', ioc.emails)
  sect('Attachments (names only)', ioc.attachments)
  if (r.warnings.length) lines.push('## Parser notes', '', ...r.warnings.map((w) => `- ${w}`), '')
  return lines.join('\n')
}
