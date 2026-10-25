import { useState, type DragEvent } from 'react'
import { SAMPLES } from '../samples'
import { LIMITS } from '../parse/limits'
import { Button, Card, Disclosure, Eyebrow, Label } from './primitives'

interface Props {
  value: string
  onChange: (v: string) => void
  onAnalyse: () => void
  onSample: (raw: string) => void
  onFile: (f: File) => void
  busy: boolean
}

export function InputPanel({ value, onChange, onAnalyse, onSample, onFile, busy }: Props) {
  const [drag, setDrag] = useState(false)
  const pickFile = () => {
    const el = document.createElement('input')
    el.type = 'file'
    el.accept = '.eml,.txt,message/rfc822,text/plain'
    el.onchange = () => { const f = el.files?.[0]; if (f) onFile(f) }
    el.click()
  }
  const drop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }
  return (
    <Card>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={drop}>
        <Label htmlFor="raw-source">Raw email source</Label>
        <textarea
          id="raw-source"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          spellCheck={false}
          autoComplete="off"
          placeholder={'Paste the full raw source here (headers and body), or drop an .eml file.\n\nReceived: from ...\nFrom: ...\nSubject: ...'}
          className={`w-full resize-y bg-[#1a1424] border text-[#f0ecfa] rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#a78bfa] transition-colors placeholder:text-[#f0ecfa]/30 ${drag ? 'border-[#a78bfa]' : 'border-[#2b2140]'}`}
        />
        <p className="mt-1 text-xs text-[#f0ecfa]/30">Maximum {LIMITS.maxInput / 1024 / 1024} MB. {value.length > 0 && `${value.length.toLocaleString()} characters.`}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onAnalyse} disabled={busy || !value.trim()}>Analyse email</Button>
        <Button onClick={pickFile}>Choose .eml file</Button>
        {value && <Button variant="ghost" onClick={() => onChange('')}>Clear</Button>}
      </div>
      <div className="mt-5">
        <Eyebrow className="mb-2">Load a sample (invented)</Eyebrow>
        <div className="grid gap-2 sm:grid-cols-3">
          {SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSample(s.raw)}
              className="rounded-xl border border-white/8 bg-[#1a1424] p-3 text-left transition-all cursor-pointer hover:border-[#a78bfa]/40 active:scale-95"
            >
              <span className="block text-sm font-semibold">{s.label}</span>
              <span className="block text-xs text-[#f0ecfa]/50">{s.blurb}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 border-t border-white/5 pt-4">
        <Disclosure title="How to get the raw source" id="how-to-raw">
          <ul className="space-y-3 text-sm text-[#f0ecfa]/70">
            <li><strong className="text-[#f0ecfa]">Gmail:</strong> open the message, click the three dots, choose <em>Show original</em>, then <em>Copy to clipboard</em>.</li>
            <li><strong className="text-[#f0ecfa]">Outlook (desktop):</strong> open the message, File, Properties, and copy the <em>Internet headers</em>; for the full source choose <em>Save as</em> and pick the .msg/.eml format. Outlook on the web: three dots, View, <em>View message source</em>.</li>
            <li><strong className="text-[#f0ecfa]">Apple Mail:</strong> select the message, View menu, Message, <em>Raw Source</em> (or <em>All Headers</em>), then copy everything.</li>
            <li className="text-xs text-[#f0ecfa]/40">Forwarding an email usually strips the original headers. Use the options above instead.</li>
          </ul>
        </Disclosure>
      </div>
    </Card>
  )
}
