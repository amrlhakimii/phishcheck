import { useState } from 'react'
import type { BandId } from '../score'
import { Card, Eyebrow } from './primitives'

interface Item { text: string; detail: string }

function itemsFor(band: BandId): Item[] {
  const never: Item[] = [
    { text: 'Do not click any link or open any attachment in this message.', detail: 'PhishCheck never did either. Treat every link as untrusted, even if it looks familiar.' },
    { text: 'Do not reply, and do not enter passwords, TAC/OTP codes or card details.', detail: 'Real organisations do not ask for these by email.' },
  ]
  if (band === 'fine') {
    return [
      { text: 'No obvious red flags found, but stay alert.', detail: 'A low score is not a guarantee. Be careful with unexpected requests for money, logins or urgent action.' },
      { text: 'Open the sender\'s official website or app yourself instead of using links in email.', detail: 'Type the address or use a bookmark.' },
      { text: 'If something still feels wrong, report it.', detail: 'Use your organisation\'s reporting button or security team.' },
    ]
  }
  const report: Item = { text: 'Report it.', detail: 'At work: forward to IT / security using the official report process (as an attachment if possible). At home: use your mail provider\'s "Report phishing" option.' }
  const del: Item = { text: 'Delete the message once it is reported.', detail: 'Also empty the trash so it is not opened by accident.' }
  const clicked: Item[] = [
    { text: 'If you already clicked or entered details: change that password now and enable MFA.', detail: 'Change it on the real site (typed by hand) and on any account that reuses the password.' },
    { text: 'If you gave banking or card details: call your bank straight away.', detail: 'Use the number on the back of your card or the official website. In Malaysia you can also call the National Scam Response Centre (997).' },
    { text: 'If you opened an attachment: disconnect from the network and tell IT / security.', detail: 'Do not keep working on that device.' },
  ]
  if (band === 'careful') {
    return [
      { text: 'Check the sender through another channel before acting.', detail: 'Call a number you already have or use the official app. Do not use contact details from the email.' },
      ...never.slice(0, 1), report, ...clicked.slice(0, 2),
    ]
  }
  return [...never, report, del, ...clicked]
}

export function ChecklistTab({ band }: { band: BandId }) {
  const items = itemsFor(band)
  const [done, setDone] = useState<Record<number, boolean>>({})
  return (
    <Card>
      <Eyebrow className="mb-1">Safe-action checklist</Eyebrow>
      <p className="text-xs text-[#EEEEEE]/40 mb-3">Tailored to the verdict. Tick items off as you go; nothing is saved.</p>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              role="checkbox"
              aria-checked={!!done[i]}
              onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border bg-[#222831] px-3 py-3 text-left min-h-11 sm:min-h-0 transition-colors hover:border-[#00ADB5]/40 ${done[i] ? 'border-[#00ADB5]/60' : 'border-white/8'}`}
            >
              <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${done[i] ? 'border-[#00ADB5] bg-[#00ADB5] text-[#222831]' : 'border-[#EEEEEE]/30'}`}>{done[i] ? '✓' : ''}</span>
              <span>
                <span className={`block text-sm font-medium ${done[i] ? 'line-through text-[#EEEEEE]/50' : ''}`}>{it.text}</span>
                <span className="block text-xs text-[#EEEEEE]/50">{it.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[#EEEEEE]/30">For a real incident, follow your organisation's reporting process. PhishCheck cannot confirm whether a message is malicious.</p>
    </Card>
  )
}
