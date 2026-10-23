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
