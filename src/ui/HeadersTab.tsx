import type { AnalysisResult } from '../analyze'
import { formatDelay } from '../received'
import { sameOrg } from '../domain'
import { Badge, Card, Eyebrow } from './primitives'
import { resultTone } from './tone'
import { defangDomain, defangEmail } from '../ioc'

const EXPLAIN: Record<string, string> = {
  spf: 'SPF: is the sending server allowed to send for this domain?',
  dkim: 'DKIM: does the cryptographic signature match the domain that signed it?',
  dmarc: 'DMARC: do SPF/DKIM line up with the visible From domain, and what does the domain owner want done if not?',
}

function TableWrap({ children, min = '32rem', caption }: { children: React.ReactNode; min?: string; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ background: '#1a1424' }}>
      <table className="w-full text-left text-xs" style={{ minWidth: min }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}
const TH = 'px-3 py-2 font-semibold text-[#f0ecfa]/50 uppercase tracking-wider'
const TD = 'px-3 py-2 align-top border-t border-white/5 break-words'

export function HeadersTab({ result }: { result: AnalysisResult }) {
  const { ctx } = result
  const idRows: { role: string; display: string; addr: string; domain: string; note: string }[] = []
  const add = (role: string, a: typeof ctx.from) => {
    if (!a) return
    const same = ctx.from?.domain && a.domain ? sameOrg(a.domain, ctx.from.domain) : null
    idRows.push({
      role,
      display: a.display,
      addr: a.address ? defangEmail(a.address) : '',
      domain: a.domain ? defangDomain(a.domain) : '',
      note: role === 'From' ? 'What your mail app shows' : same === null ? '' : same ? 'Matches From' : 'Different from From',
    })
  }
  add('From', ctx.from)
  add('Return-Path', ctx.returnPath)
  add('Reply-To', ctx.replyTo)
  add('Sender', ctx.sender)
  return (
    <div className="space-y-4">
      <Card>
        <Eyebrow className="mb-1">Received chain (oldest hop first)</Eyebrow>
        <p className="text-xs text-[#f0ecfa]/40 mb-3">Each mail server adds a Received line on top. Read from the bottom up to follow the message. Only the line added by your own provider is trustworthy; earlier hops can be forged.</p>
        {ctx.hops.length === 0 ? (
          <p className="text-sm text-[#f0ecfa]/50">No Received headers found.</p>
        ) : (
          <TableWrap caption="Received chain" min="40rem">
            <thead>
              <tr>
                <th scope="col" className={TH}>Hop</th>
                <th scope="col" className={TH}>From</th>
                <th scope="col" className={TH}>By</th>
                <th scope="col" className={TH}>Time</th>
                <th scope="col" className={TH}>Delay</th>
              </tr>
            </thead>
            <tbody>
              {ctx.hops.map((h) => (
                <tr key={h.index} data-testid="hop-row">
                  <td className={TD}>{h.index}</td>
                  <td className={`${TD} font-mono`}>{defangDomain(h.from) || '-'}{h.ips.length > 0 && <span className="block text-[#f0ecfa]/40">{h.ips.map(defangDomain).join(', ')}</span>}</td>
                  <td className={`${TD} font-mono`}>{defangDomain(h.by) || '-'}{h.protocol && <span className="block text-[#f0ecfa]/40">{h.protocol}</span>}</td>
                  <td className={TD}>{h.dateText || 'unknown'}</td>
                  <td className={TD} data-testid="hop-delay">
                    {h.index === 1 ? <span className="text-[#f0ecfa]/40">start</span> : (
                      <Badge tone={h.delaySec === null ? 'muted' : h.delaySec < -120 ? 'danger' : h.delaySec > 86400 ? 'warning' : 'accent'}>{formatDelay(h.delaySec)}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <Eyebrow className="mb-1">Authentication results</Eyebrow>
        <p className="text-xs text-[#f0ecfa]/40 mb-3">Recorded by the receiving mail server. A pass proves the sending domain authorised the message, not that the message is trustworthy.</p>
        {ctx.auth.length === 0 ? (
          <p className="text-sm text-[#f0ecfa]/50">No Authentication-Results or Received-SPF header found.</p>
        ) : (
          <TableWrap caption="Authentication results" min="32rem">
            <thead>
              <tr>
                <th scope="col" className={TH}>Method</th>
                <th scope="col" className={TH}>Result</th>
                <th scope="col" className={TH}>Details</th>
              </tr>
            </thead>
            <tbody>
              {ctx.auth.map((r, i) => (
                <tr key={i}>
                  <td className={`${TD} font-semibold uppercase`}>{r.method}</td>
                  <td className={TD}><Badge tone={resultTone(r.result)}>{r.result || 'n/a'}</Badge></td>
                  <td className={`${TD} text-[#f0ecfa]/70`}>
                    {Object.entries(r.props).slice(0, 4).map(([k, v]) => <span key={k} className="mr-2 font-mono">{k}={defangDomain(v)}</span>)}
                    {EXPLAIN[r.method] && <span className="block text-[#f0ecfa]/40 mt-1">{EXPLAIN[r.method]}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <Card>
        <Eyebrow className="mb-1">Sender identity</Eyebrow>
        <p className="text-xs text-[#f0ecfa]/40 mb-3">Mail has several "senders". From is what you see; Return-Path is where bounces go; Reply-To is where your reply goes. Legitimate mail usually keeps them in one organisation.</p>
        {idRows.length === 0 ? (
          <p className="text-sm text-[#f0ecfa]/50">No sender headers found.</p>
        ) : (
          <TableWrap caption="Sender identity" min="34rem">
            <thead>
              <tr>
                <th scope="col" className={TH}>Header</th>
                <th scope="col" className={TH}>Display name</th>
                <th scope="col" className={TH}>Address (defanged)</th>
                <th scope="col" className={TH}>Note</th>
              </tr>
            </thead>
            <tbody>
              {idRows.map((r) => (
                <tr key={r.role}>
                  <td className={`${TD} font-semibold`}>{r.role}</td>
                  <td className={TD}>{r.display || <span className="text-[#f0ecfa]/30">none</span>}</td>
                  <td className={`${TD} font-mono`}>{r.addr || r.domain || '-'}</td>
                  <td className={TD}>{r.note && <Badge tone={r.note.startsWith('Different') ? 'danger' : r.note === 'Matches From' ? 'success' : 'muted'}>{r.note}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  )
}
