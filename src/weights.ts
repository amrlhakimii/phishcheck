/**
 * Every point the score can gain or lose is listed here. The UI "How the score works" panel and the
 * README table are generated from / mirror this file. No hidden logic.
 */
export interface WeightDef {
  code: string
  check: string
  label: string
  points: number
}

export const WEIGHTS: WeightDef[] = [
  { code: 'C1.dmarc_fail', check: 'C1', label: 'DMARC fails', points: 18 },
  { code: 'C1.spf_fail', check: 'C1', label: 'SPF fails', points: 15 },
  { code: 'C1.dkim_fail', check: 'C1', label: 'DKIM fails', points: 12 },
  { code: 'C1.spf_softfail', check: 'C1', label: 'SPF softfail', points: 8 },
  { code: 'C1.other_error', check: 'C1', label: 'Authentication temperror / permerror', points: 4 },
  { code: 'C1.missing', check: 'C1', label: 'No authentication results in the headers', points: 4 },
  { code: 'C2.replyto_mismatch', check: 'C2', label: 'Reply-To domain differs from From', points: 12 },
  { code: 'C2.returnpath_mismatch', check: 'C2', label: 'Return-Path domain differs from From', points: 10 },
  { code: 'C2.sender_mismatch', check: 'C2', label: 'Sender header domain differs from From', points: 6 },
  { code: 'C3.address_in_name', check: 'C3', label: 'Display name contains a different email address', points: 20 },
  { code: 'C3.brand_in_name', check: 'C3', label: 'Display name names a brand but the domain is not the brand\'s', points: 18 },
  { code: 'C4.homoglyph', check: 'C4', label: 'Look-alike spelling of a brand (e.g. paypa1, rnicrosoft)', points: 30 },
  { code: 'C4.idn_homoglyph', check: 'C4', label: 'Punycode / non-Latin look-alike of a brand', points: 32 },
  { code: 'C4.typosquat', check: 'C4', label: 'Brand name misspelled by 1-2 characters', points: 24 },
  { code: 'C4.brand_in_domain', check: 'C4', label: 'Brand name embedded in an unrelated domain', points: 16 },
  { code: 'C4.brand_other_domain', check: 'C4', label: 'Brand label on a domain the brand does not own', points: 12 },
  { code: 'C4.punycode', check: 'C4', label: 'Punycode (xn--) domain', points: 14 },
  { code: 'C4.suspicious_tld', check: 'C4', label: 'Suspicious top-level domain', points: 8 },
  { code: 'C4.many_subdomains', check: 'C4', label: 'Excessive subdomains', points: 6 },
  { code: 'C5.mismatch', check: 'C5', label: 'Link text shows a different site than the link goes to (per link, capped for the check)', points: 20 },
  { code: 'C6.ip_url', check: 'C6', label: 'URL uses an IP address', points: 10 },
  { code: 'C6.ip_obfuscated', check: 'C6', label: 'URL uses a decimal / hex / octal IP', points: 14 },
  { code: 'C6.userinfo', check: 'C6', label: '"@" (userinfo) in URL', points: 12 },
  { code: 'C6.script_url', check: 'C6', label: 'data: or javascript: URL', points: 15 },
  { code: 'C6.shortener', check: 'C6', label: 'URL shortener', points: 6 },
  { code: 'C6.long_encoded', check: 'C6', label: 'Very long or heavily encoded URL', points: 4 },
  { code: 'C6.http', check: 'C6', label: 'Link uses plain http', points: 3 },
  { code: 'C7.urgency_many', check: 'C7', label: 'Urgency / pressure wording, 5 or more phrases', points: 12 },
  { code: 'C7.urgency_some', check: 'C7', label: 'Urgency / pressure wording, 3-4 phrases', points: 8 },
  { code: 'C7.urgency_few', check: 'C7', label: 'Urgency / pressure wording, 1-2 phrases', points: 4 },
  { code: 'C8.credentials', check: 'C8', label: 'Asks for password / OTP / card / bank login', points: 18 },
  { code: 'C8.payment', check: 'C8', label: 'Pushes a payment or transfer', points: 8 },
  { code: 'C9.executable', check: 'C9', label: 'Executable / script attachment', points: 25 },
  { code: 'C9.double_ext', check: 'C9', label: 'Double extension (e.g. .pdf.exe)', points: 25 },
  { code: 'C9.html_attach', check: 'C9', label: 'HTML / HTM attachment', points: 15 },
  { code: 'C9.macro', check: 'C9', label: 'Macro-enabled Office attachment', points: 15 },
  { code: 'C9.disk_image', check: 'C9', label: 'Disk image / shortcut / archive attachment', points: 12 },
  { code: 'C9.archive_password', check: 'C9', label: 'Archive plus password mentioned in the body', points: 8 },
  { code: 'C10.no_message_id', check: 'C10', label: 'Missing Message-ID', points: 4 },
  { code: 'C10.bad_date', check: 'C10', label: 'Date far in the future or past, or missing', points: 4 },
  { code: 'C10.received_order', check: 'C10', label: 'Received chain timestamps go backwards', points: 3 },
  { code: 'C10.received_delay', check: 'C10', label: 'Very long delay between hops (over 24 h)', points: 2 },
  { code: 'C11.hidden_text', check: 'C11', label: 'Hidden text via CSS', points: 5 },
  { code: 'C11.pixel', check: 'C11', label: '1x1 / hidden tracking image', points: 3 },
  { code: 'C11.many_images', check: 'C11', label: 'Many remote images (over 10)', points: 2 },
  { code: 'C12.all_pass', check: 'C12', label: 'SPF, DKIM and DMARC all pass and align with From', points: -15 },
  { code: 'C12.partial_pass', check: 'C12', label: 'Some authentication passes and aligns (no failures)', points: -6 },
  { code: 'C12.consistent', check: 'C12', label: 'From, Return-Path and Reply-To domains consistent', points: -5 },
  { code: 'DNS.nxdomain', check: 'DNS', label: 'Sender domain does not exist (optional DNS check)', points: 10 },
  { code: 'DNS.no_spf', check: 'DNS', label: 'Sender domain publishes no SPF record (optional DNS check)', points: 3 },
  { code: 'DNS.no_dmarc', check: 'DNS', label: 'Sender domain publishes no DMARC record (optional DNS check)', points: 3 },
]

const BY_CODE = new Map(WEIGHTS.map((w) => [w.code, w]))

export function weight(code: string): number {
  const w = BY_CODE.get(code)
  if (!w) throw new Error(`Unknown weight code: ${code}`)
  return w.points
}

/** Maximum a single check may add, so one noisy check cannot dominate the score. */
export const CHECK_CAPS: Record<string, number> = {
  C1: 35, C2: 20, C3: 25, C4: 40, C5: 30, C6: 20, C7: 12, C8: 22, C9: 35, C10: 8, C11: 8, DNS: 12,
}
/** Maximum a check may subtract. */
export const GOOD_CAP = -20

export const BANDS = [
  { id: 'fine', min: 0, max: 24, label: 'Looks fine', tone: 'success', blurb: 'No obvious red flags were found. That is not a guarantee of safety.' },
  { id: 'careful', min: 25, max: 49, label: 'Be careful', tone: 'warning', blurb: 'A few indicators were found. Check the sender through another channel before acting.' },
  { id: 'suspicious', min: 50, max: 74, label: 'Suspicious', tone: 'orange', blurb: 'Several indicators point to a possible phishing attempt. Do not click or reply.' },
  { id: 'phishing', min: 75, max: 100, label: 'Likely phishing', tone: 'danger', blurb: 'Many strong indicators of phishing. Do not interact; report and delete it.' },
] as const
