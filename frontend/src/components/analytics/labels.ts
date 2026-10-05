const knownSites: Record<string, string> = {
  'linkedin.com': 'LinkedIn',
  'lnkd.in': 'LinkedIn',
  'mail.google.com': 'Gmail',
  'outlook.live.com': 'Outlook',
  'outlook.office.com': 'Outlook',
  'google.com': 'Google',
  'github.com': 'GitHub',
  't.co': 'X (Twitter)',
  'x.com': 'X (Twitter)',
  'wellfound.com': 'Wellfound',
  'naukri.com': 'Naukri',
  'instahyre.com': 'Instahyre',
  'web.whatsapp.com': 'WhatsApp',
  'slack.com': 'Slack',
}

export function referrerLabel(host: string | null) {
  if (!host || host === 'direct') return 'Direct or unknown'
  const bare = host.replace(/^www\./, '')
  const match = Object.keys(knownSites).find(
    (site) => bare === site || bare.endsWith(`.${site}`),
  )
  return match ? knownSites[match] : bare
}

const regions = new Intl.DisplayNames(['en-IN'], { type: 'region' })

export function countryLabel(code: string | null) {
  if (!code || code === 'unknown' || code === 'XX') return 'Unknown'
  try {
    return regions.of(code) ?? code
  } catch {
    return code
  }
}

// "Pune, MH": the city with its region code, as the hosting provider reports it.
export function cityLabel(place: string | null) {
  return !place || place === 'unknown' ? 'Unknown' : place
}

export function deviceLabel(device: string | null) {
  if (!device || device === 'unknown') return 'Unknown'
  return device.charAt(0).toUpperCase() + device.slice(1)
}
