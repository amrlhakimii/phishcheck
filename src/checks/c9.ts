import type { Context } from '../context'
import type { Finding } from '../types'
import { ARCHIVE_PASSWORD_HINTS, findPhrases } from '../data/keywords'
import { mk } from './util'

const EXEC = new Set(['exe', 'scr', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'bat', 'cmd', 'com', 'pif', 'msi', 'ps1', 'jar', 'hta', 'cpl', 'reg', 'dll', 'apk', 'appimage', 'sh', 'bin'])
const HTMLX = new Set(['html', 'htm', 'xhtml', 'shtml', 'svg'])
const MACRO = new Set(['docm', 'xlsm', 'pptm', 'dotm', 'xlam', 'xlsb', 'ppam', 'sldm'])
const IMAGE_ARCH = new Set(['iso', 'img', 'lnk', 'vhd', 'vhdx', 'zip', 'rar', '7z', 'gz', 'tar', 'cab', 'ace', 'dmg', 'one', 'url'])
const DOC = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'rtf', 'csv'])

export function extOf(name: string): string[] {
  return name.toLowerCase().trim().split('.').slice(1)
}

/** C9: attachment risk from names and declared types only. Content is never opened. */
export function c9(ctx: Context): Finding[] {
  const out: Finding[] = []
  const hasArchive = ctx.email.attachments.some((a) => IMAGE_ARCH.has(extOf(a.filename).at(-1) ?? ''))
  for (const [i, a] of ctx.email.attachments.entries()) {
    const exts = extOf(a.filename)
    const last = exts.at(-1) ?? ''
    const prev = exts.at(-2) ?? ''
    const ev = `${a.filename || '(no name)'} [${a.contentType}, ~${a.size} bytes]`
    const sfx = String(i)
    if (exts.length >= 2 && DOC.has(prev) && (EXEC.has(last) || HTMLX.has(last) || IMAGE_ARCH.has(last) || MACRO.has(last))) {
      out.push(mk({ check: 'C9', code: 'C9.double_ext', severity: 'high', suffix: sfx, title: 'Attachment with a double extension', evidence: ev,
        why: 'A name like invoice[.]pdf[.]exe is built to look like a document while really being a program. Many mail apps hide the final extension.', action: 'Do not open it. Report it.' }))
    } else if (EXEC.has(last)) {
      out.push(mk({ check: 'C9', code: 'C9.executable', severity: 'high', suffix: sfx, title: 'Executable or script attachment', evidence: ev,
        why: 'Programs and scripts run code on your computer when opened. Legitimate senders almost never email them.', action: 'Do not open it. Report it.' }))
    } else if (HTMLX.has(last)) {
      out.push(mk({ check: 'C9', code: 'C9.html_attach', severity: 'high', suffix: sfx, title: 'HTML attachment', evidence: ev,
        why: 'HTML files can show a fake login page that runs locally, bypassing link scanners. They are a common credential-phishing trick.', action: 'Do not open it.' }))
    } else if (MACRO.has(last)) {
      out.push(mk({ check: 'C9', code: 'C9.macro', severity: 'medium', suffix: sfx, title: 'Macro-enabled Office file', evidence: ev,
        why: 'Macros can download and run malware once enabled. Attackers often tell you to "Enable content".', action: 'Do not open it or enable macros.' }))
    } else if (IMAGE_ARCH.has(last)) {
      out.push(mk({ check: 'C9', code: 'C9.disk_image', severity: 'medium', suffix: sfx, title: 'Disk image, shortcut or archive attachment', evidence: ev,
        why: 'Archives, disk images and shortcut files are used to smuggle malware past mail filters.', action: 'Do not open it unless you expected it from this sender.' }))
    }
  }
  if (hasArchive && findPhrases(ctx.bodyText, ARCHIVE_PASSWORD_HINTS, 3).length) {
    out.push(mk({ check: 'C9', code: 'C9.archive_password', severity: 'medium', title: 'Archive attached and a password is given in the message',
      evidence: 'Body mentions a password for the attached archive.',
      why: 'Password-protected archives cannot be scanned by mail filters, which is exactly why attackers use them.', action: 'Do not open it.' }))
  }
  return out
}
