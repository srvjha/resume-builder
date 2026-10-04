import { Link, createFileRoute } from '@tanstack/react-router'
import { HeroDemo } from '@/components/landing/hero-demo'
import {
  EditModes,
  Faq,
  FinalCta,
  HonestAi,
  HowItWorks,
  ShareSection,
  TemplatesShowcase,
} from '@/components/landing/sections'
import { Button } from '@/components/ui/button'
import { site } from '@/lib/site'

const title = `AI Resume Builder, Tailored to Every Job | ${site.name}`
const description =
  'Free AI resume builder: tailor your resume to each job description in one click, with LaTeX-quality templates and a free ATS checker. Built in India.'

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: site.name,
      url: site.url,
      logo: `${site.url}/favicon.svg`,
      email: site.contactEmail,
    },
    {
      '@type': 'WebApplication',
      name: site.name,
      url: site.url,
      description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    },
  ],
}

export const Route = createFileRoute('/_site/')({
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: `${site.url}/` },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: `${site.url}/` }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(structuredData),
      },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-5 pt-14 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div>
          <h1 className="text-[2.6rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl">
            Your resume, rewritten for every job you apply to
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
            Paste a job description and get a tailored version of your resume in
            under a minute. Every change is highlighted for you to accept or
            skip. It looks typeset in LaTeX, and you never have to touch LaTeX.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to="/login" search={{ mode: 'signup' }}>
                Build my resume
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/templates">See templates</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Unlimited resumes, free. No card needed. Already have one?{' '}
            <Link
              to="/ats-checker"
              className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
            >
              Check its ATS score
            </Link>
            .
          </p>
        </div>
        <HeroDemo />
      </section>
      <HowItWorks />
      <EditModes />
      <HonestAi />
      <TemplatesShowcase />
      <ShareSection />
      <Faq />
      <FinalCta />
    </>
  )
}
