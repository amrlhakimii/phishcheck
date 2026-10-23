/**
 * Three INVENTED sample emails for demos and tests.
 * Domains are reserved (example.com / example.net / example.org / .test) and IPs come from the
 * documentation ranges 203.0.113.0/24 and 198.51.100.0/24. Brand names appear only as the targets
 * being imitated. No real people or organisations are senders.
 */

function b64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return (btoa(bin).match(/.{1,76}/g) ?? []).join('\n')
}

const PHISH_HTML = `<html><body style="font-family:Arial">
<p>Salam pelanggan,</p>
<p>Kami mengesan aktiviti mencurigakan pada akaun anda. Akaun anda akan digantung dalam masa 24 jam.</p>
<p>Sila log masuk untuk sahkan akaun anda dan masukkan kata laluan serta nombor TAC:</p>
<p><a href="http://203.0.113.45/m2u/login.php?session=expired">www.maybank2u.com.my/login</a></p>
<p>Atau guna pautan ini: <a href="http://3405803821/verify">Sahkan sekarang</a></p>
<p>Urgent: verify your account immediately. Failure to comply will result in permanent closure.</p>
<p>Security Team</p>
<img src="http://203.0.113.45/pixel.gif" width="1" height="1">
<div style="font-size:0;color:#ffffff">weekly statement balance account notice meeting agenda</div>
</body></html>`

const PHISH_TEXT = `Salam pelanggan,

Kami mengesan aktiviti mencurigakan pada akaun anda. Akaun anda akan digantung
dalam masa 24 jam. Sila sahkan akaun anda dan masukkan kata laluan serta nombor TAC.

Urgent: verify your account immediately. Failure to comply will result in permanent closure.

Security Team`

export const SAMPLE_PHISH = `Received: from relay.example.test (relay.example.test [203.0.113.45])
	by mx.example.com with ESMTP id abc123
	for <victim@example.com>; Sat, 24 Oct 2026 02:14:09 +0000
Received: from localhost (webhost.example.test [198.51.100.23])
	by relay.example.test with SMTP; Sat, 24 Oct 2026 02:14:07 +0000
Received: from [10.0.0.5] (unknown [198.51.100.23])
	by webhost.example.test with HTTP; Sat, 24 Oct 2026 02:03:51 +0000
Authentication-Results: mx.example.com;
	spf=fail smtp.mailfrom=mailer.example.org;
	dkim=none;
	dmarc=fail header.from=secure-login-center.example.test
Return-Path: <bounce@mailer.example.org>
From: =?UTF-8?B?TWF5YmFuayBTZWN1cml0eQ==?= <alert@secure-login-center.example.test>
Reply-To: helpdesk-claims@example.net
To: victim@example.com
Subject: =?UTF-8?Q?URGENT:_Akaun_anda_akan_digantung_=E2=80=93_sahkan_sekarang?=
Date: Sat, 24 Oct 2026 02:03:50 +0000
Message-ID: <phish-001@secure-login-center.example.test>
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="mix-boundary-01"

--mix-boundary-01
Content-Type: multipart/alternative; boundary="alt-boundary-01"

--alt-boundary-01
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 7bit

${PHISH_TEXT}
--alt-boundary-01
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: base64

${b64(PHISH_HTML)}
--alt-boundary-01--

--mix-boundary-01
Content-Type: application/octet-stream; name="Statement_Oct2026.pdf.exe"
Content-Disposition: attachment; filename="Statement_Oct2026.pdf.exe"
Content-Transfer-Encoding: base64

${b64('DUMMY ATTACHMENT BYTES - not a real program')}
--mix-boundary-01--
`

const LOOKALIKE_HTML = `<html><body>
<p>Hello,</p>
<p>We were unable to process your latest subscription payment. Payment failed because the card on file was declined.</p>
<p>To avoid interruption, please sign in and confirm your password and billing details within 48 hours:</p>
<p><a href="https://rnicrosoft.test/account/billing?ref=7f3a">https://account.microsoft.com/billing</a></p>
<p>Thank you,<br>Account Services</p>
</body></html>`

const LOOKALIKE_TEXT = `Hello,

We were unable to process your latest subscription payment. Payment failed because the
card on file was declined.

To avoid interruption, please sign in and confirm your password and billing details
within 48 hours: https://rnicrosoft.test/account/billing?ref=7f3a

Thank you,
Account Services
`

export const SAMPLE_LOOKALIKE = `Received: from mail.rnicrosoft.test (mail.rnicrosoft.test [198.51.100.77])
	by mx.example.com with ESMTPS id q91; Sat, 24 Oct 2026 08:41:12 +0000
Received: from app01.rnicrosoft.test (app01.rnicrosoft.test [198.51.100.78])
	by mail.rnicrosoft.test with ESMTP; Sat, 24 Oct 2026 08:41:11 +0000
Authentication-Results: mx.example.com;
	spf=pass smtp.mailfrom=rnicrosoft.test;
	dkim=pass header.d=rnicrosoft.test;
	dmarc=pass header.from=rnicrosoft.test
Return-Path: <billing@rnicrosoft.test>
From: Account Services <billing@rnicrosoft.test>
To: user@example.com
Subject: Action needed: your payment failed
Date: Sat, 24 Oct 2026 08:41:10 +0000
Message-ID: <lookalike-7@rnicrosoft.test>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="b1"

--b1
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

${LOOKALIKE_TEXT.replace(/=/g, '=3D')}
--b1
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

${LOOKALIKE_HTML.replace(/=/g, '=3D').replace(/(.{70})/g, '$1=\n')}
--b1--
`

const NEWS_HTML = `<html><body>
<h1>Example Weekly</h1>
<p>Hi there, here is what is new this week.</p>
<ul>
<li><a href="https://www.example.com/blog/spring-garden-tips">Ten garden tips for the rainy season</a></li>
<li><a href="https://click.newsletter.example.com/r/4412">Read more</a></li>
<li><a href="https://www.example.com/events">www.example.com/events</a></li>
</ul>
<p>Limited time: members get early access to the autumn sale.</p>
<p><a href="https://www.example.com/unsubscribe?u=1234">Unsubscribe</a> | <a href="https://www.example.com/preferences">Preferences</a></p>
<img src="https://click.newsletter.example.com/open/4412.gif" width="1" height="1" alt="">
</body></html>`

const NEWS_TEXT = `Example Weekly

Hi there, here is what is new this week.

- Ten garden tips for the rainy season: https://www.example.com/blog/spring-garden-tips
- Events: https://www.example.com/events

Limited time: members get early access to the autumn sale.

Unsubscribe: https://www.example.com/unsubscribe?u=1234
`

export const SAMPLE_NEWSLETTER = `Received: from out.newsletter.example.com (out.newsletter.example.com [198.51.100.10])
	by mx.example.net with ESMTPS id n7; Fri, 23 Oct 2026 06:00:09 +0000
Received: from queue1.newsletter.example.com (queue1.newsletter.example.com [198.51.100.11])
	by out.newsletter.example.com with ESMTP; Fri, 23 Oct 2026 06:00:08 +0000
Authentication-Results: mx.example.net;
	spf=pass smtp.mailfrom=bounce.newsletter.example.com;
	dkim=pass header.d=newsletter.example.com;
	dmarc=pass header.from=newsletter.example.com
Return-Path: <bounce@bounce.newsletter.example.com>
From: Example Weekly <news@newsletter.example.com>
Reply-To: hello@example.com
To: subscriber@example.net
Subject: =?UTF-8?B?RXhhbXBsZSBXZWVrbHkg4oCTIGdhcmRlbiB0aXBzIGFuZCBldmVudHM=?=
Date: Fri, 23 Oct 2026 06:00:00 +0000
Message-ID: <weekly-4412@newsletter.example.com>
List-Unsubscribe: <https://www.example.com/unsubscribe?u=1234>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="news-alt"

--news-alt
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: base64

${b64(NEWS_TEXT)}
--news-alt
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: base64

${b64(NEWS_HTML)}
--news-alt--
`

export interface Sample { id: string; label: string; blurb: string; raw: string }

export const SAMPLES: Sample[] = [
  { id: 'phish', label: 'Obvious phish', blurb: 'Fake bank alert in English and Bahasa Malaysia, failed authentication, disguised links, executable attachment.', raw: SAMPLE_PHISH },
  { id: 'lookalike', label: 'Lookalike-domain phish', blurb: 'Passes authentication, but the domain is a look-alike (rn instead of m) and the link text lies.', raw: SAMPLE_LOOKALIKE },
  { id: 'newsletter', label: 'Legitimate newsletter', blurb: 'Authenticated marketing email with a tracking pixel: should score low.', raw: SAMPLE_NEWSLETTER },
]
