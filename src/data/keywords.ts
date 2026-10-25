/** Wording lists, English and Bahasa Malaysia. Lower-case; matched as substrings of lower-cased text. */

export const URGENCY: string[] = [
  // English
  'act now', 'act immediately', 'immediate action', 'urgent', 'urgently', 'within 24 hours', 'within 48 hours',
  'account suspended', 'account has been suspended', 'account will be suspended', 'account locked', 'account has been locked',
  'account will be closed', 'account will be terminated', 'verify your account', 'verify within', 'final notice', 'final warning',
  'last warning', 'immediately', 'failure to comply', 'unauthorized login', 'unusual activity', 'suspicious activity',
  'your access will be', 'expires today', 'limited time', 'click here now', 'avoid suspension', 'legal action',
  'congratulations', 'you have won', 'you won', 'claim your prize', 'claim your reward', 'gift card', 'free gift', 'lucky winner',
  'payment overdue', 'payment failed', 'outstanding payment', 'unpaid invoice', 'refund pending', 'pending refund',
  // Bahasa Malaysia
  'tindakan segera', 'segera', 'dalam masa 24 jam', 'dalam tempoh 24 jam', 'akaun anda akan digantung', 'akaun anda telah digantung',
  'akaun disekat', 'akaun anda disekat', 'akaun akan ditutup', 'sahkan akaun', 'sahkan akaun anda', 'notis terakhir', 'amaran terakhir',
  'aktiviti mencurigakan', 'aktiviti luar biasa', 'tamat tempoh hari ini', 'tindakan undang-undang', 'tindakan guaman',
  'tahniah', 'anda telah menang', 'anda memenangi', 'tuntut hadiah', 'tuntut ganjaran', 'hadiah percuma', 'pemenang bertuah',
  'bayaran tertunggak', 'pembayaran gagal', 'bayaran tertangguh', 'bayaran balik', 'denda', 'saman tertunggak',
  'pakej anda tertahan', 'parcel anda tertahan',
]

export const CREDENTIALS: string[] = [
  // English
  'enter your password', 'confirm your password', 'your password', 'reset your password', 'update your password', 'login credentials',
  'log in to verify', 'sign in to verify', 'sign in to confirm', 'verify your identity', 'confirm your identity', 'one-time password',
  'one time password', 'otp', 'tac code', 'verification code', 'security code', 'pin number', 'your pin', 'card number', 'credit card number',
  'debit card', 'cvv', 'cvc', 'expiry date', 'bank login', 'online banking', 'internet banking', 'bank account number', 'account number and',
  'update your payment', 'update your billing', 'confirm your billing', 'social security', 'mykad number', 'ic number', 'secure access code',
  // Bahasa Malaysia
  'kata laluan', 'masukkan kata laluan', 'tukar kata laluan', 'kemaskini kata laluan', 'nombor tac', 'kod tac', 'kod otp', 'kod pengesahan',
  'nombor kad', 'nombor kad kredit', 'nombor pin', 'nombor akaun', 'maklumat perbankan', 'log masuk perbankan', 'perbankan internet',
  'sahkan identiti', 'kemaskini maklumat', 'kemaskini maklumat bank', 'nombor mykad', 'no. kad pengenalan', 'no kad pengenalan',
]

export const PAYMENT_PUSH: string[] = [
  'wire transfer', 'bank transfer', 'transfer the funds', 'send payment', 'pay now', 'pay immediately', 'make a payment', 'bitcoin', 'crypto wallet',
  'gift card codes', 'bank-in', 'bank in', 'pindahan wang', 'buat pembayaran', 'bayar sekarang', 'bayar segera', 'pindah wang',
]

export const ARCHIVE_PASSWORD_HINTS: string[] = [
  'password is', 'the password:', 'password:', 'zip password', 'archive password', 'unzip with', 'kata laluan fail', 'kata laluan:',
]

export function findPhrases(text: string, phrases: string[], limit = 12): string[] {
  const t = text.toLowerCase().slice(0, 600_000)
  const hits: string[] = []
  for (const p of phrases) {
    if (t.includes(p)) {
      // word-ish boundary check for very short tokens such as "otp", "cvv"
      if (p.length <= 4) {
        const re = new RegExp(`(^|[^a-z0-9])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
        if (!re.test(t)) continue
      }
      hits.push(p)
      if (hits.length >= limit) break
    }
  }
  return hits
}

/**
 * Social-engineering phrase GROUPS (English + Bahasa Malaysia) for C14. A group counts once however many
 * of its phrases appear, so the finding is weighted by how many different kinds of ask are in the message.
 */
export const SOCIAL_GROUPS: { id: string; label: string; phrases: string[] }[] = [
  { id: 'giftcard', label: 'gift cards / voucher codes', phrases: ['gift card', 'giftcard', 'voucher code', 'itunes card', 'apple gift', 'google play card', 'google play gift', 'steam card', 'steam gift', 'kad hadiah', 'kod baucar'] },
  { id: 'transfer', label: 'wire / bank transfer', phrases: ['wire transfer', 'bank transfer', 'transfer the funds', 'transfer funds', 'pindahan wang', 'pindah wang', 'buat pindahan'] },
  { id: 'bankchange', label: 'change of bank details', phrases: ['change of bank', 'changed our bank', 'new bank details', 'updated bank details', 'bank details have changed', 'new account number', 'tukar akaun bank', 'akaun bank baharu', 'akaun bank baru', 'nombor akaun baharu'] },
  { id: 'availability', label: 'availability / favour opener', phrases: ['are you available', 'are you at your desk', 'quick favour', 'quick favor', 'do me a favour', 'do me a favor', 'need a favour', 'need a favor', 'adakah anda free', 'boleh tolong saya', 'minta tolong sikit'] },
  { id: 'secrecy', label: 'secrecy', phrases: ['keep this confidential', 'keep it confidential', 'keep this between us', 'between us', "don't tell anyone", 'do not tell anyone', "don't share this", 'do not discuss this', 'jangan beritahu', 'rahsiakan'] },
  { id: 'purchase', label: 'buy and send codes', phrases: ['buy gift', 'purchase gift', 'buy 5 gift', 'send me the codes', 'send the codes', 'send me the pin', 'photo of the card', 'picture of the card', 'scratch off', 'beli kad', 'hantar kod'] },
  { id: 'urgentreq', label: 'urgent request', phrases: ['urgent request', 'urgent task', 'urgent matter', 'permintaan segera', 'urusan segera', 'perkara segera', 'tugasan segera'] },
]

/** Authority titles for C13. Short acronyms are case-sensitive to avoid matching ordinary words. */
export const AUTHORITY_ACRONYMS: string[] = ['CEO', 'CFO', 'COO', 'CTO', 'CIO', 'MD', 'HR']
export const AUTHORITY_WORDS: string[] = [
  'managing director', 'director', 'president', 'chairman', 'chairperson', 'boss', 'finance', 'human resources', 'payroll',
  'pengarah urusan', 'pengarah', 'pengerusi', 'presiden', 'ketua pegawai eksekutif', 'bos',
]
/** Honorific titles; only count at the very start of the display name. */
export const AUTHORITY_PREFIXES: string[] = ['dato sri', "dato'", 'dato', 'datuk seri', 'datuk', 'tan sri', 'tun', 'tuan', 'puan']

export const FREEMAIL_DOMAINS: string[] = [
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com', 'live.com', 'mail.com',
]

/** QR-code lure wording (C15). */
export const QR_MENTION = /\bqr[\s-]?(?:code|kod)?\b|\bkod qr\b|\bbarcode\b|\bscan (?:the|this|that) (?:code|image)\b/
export const QR_SCAN_VERB = /\b(?:scan|scanning|camera|imbas)\b/
export const QR_ACTION = /\b(?:continue|verify|verification|re-?enrol(?:l)?|enrol(?:l)?|mfa|2fa|two-factor|multi-factor|authenticat\w*|pay|payment|log ?in|sign ?in|access|unlock|update|secure|confirm|teruskan|sahkan|bayar|log masuk|akses)\b/
