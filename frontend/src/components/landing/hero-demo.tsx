import { CheckIcon, RotateCcwIcon, SparklesIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// The hero's one orchestrated moment: a resume being tailored to a job, change by change.

const job = {
  title: 'Backend Engineer',
  company: 'Swiggy',
  skills: ['Go', 'PostgreSQL', 'Kafka'],
}

const bullets = [
  {
    before: 'Worked on payouts service in Go which gets 2M requests daily',
    after: (
      <>
        Built the merchant payouts service in <b>Go</b>, handling 2M requests a
        day
      </>
    ),
    step: 1,
  },
  {
    before: 'Made reports 40% faster, fixed PostgreSQL queries and indexes',
    after: (
      <>
        Cut report latency by 40% by rewriting <b>PostgreSQL</b> queries and
        adding indexes
      </>
    ),
    step: 2,
  },
  { before: 'Organised the college tech fest website', after: null, step: 3 },
]

const timings = [900, 2300, 3600, 4600]

function Highlight({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  return (
    <motion.span
      className="box-decoration-clone rounded-[2px] bg-no-repeat px-0.5"
      style={{
        backgroundImage: 'linear-gradient(var(--highlight), var(--highlight))',
        backgroundPosition: '0 88%',
      }}
      initial={false}
      animate={{ backgroundSize: active ? '100% 42%' : '0% 42%' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.span>
  )
}

export function HeroDemo() {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (reduceMotion) {
      setStep(timings.length)
      return
    }
    setStep(0)
    const timers = timings.map((ms, index) =>
      setTimeout(() => setStep(index + 1), ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [reduceMotion, run])

  const done = step >= timings.length

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative z-10 -mb-6 ml-4 w-60 rounded-lg border bg-card p-3 shadow-sm sm:-ml-6">
        <p className="text-xs text-muted-foreground">Tailoring for</p>
        <p className="font-medium">
          {job.title}, {job.company}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {job.skills.map((skill) => (
            <Badge key={skill} variant="secondary">
              {skill}
            </Badge>
          ))}
        </div>
      </div>

      <figure
        aria-label="Example resume being tailored to a job"
        className="rounded-md bg-sheet px-7 pt-14 pb-7 text-sheet-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_12px_40px_-12px_rgb(0_0_0/0.25)] ring-1 ring-black/5 sm:px-9"
      >
        <div className="text-center font-serif">
          <p className="text-2xl tracking-wide [font-variant-caps:small-caps]">
            Aarav Sharma
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            aarav@example.com | github.com/aarav | Bengaluru
          </p>
        </div>

        <p className="mt-5 border-b border-neutral-800 pb-0.5 font-serif text-sm font-semibold [font-variant-caps:small-caps]">
          Experience
        </p>
        <div className="mt-2 flex items-baseline justify-between font-serif text-[13px]">
          <span className="font-semibold">Razorpay</span>
          <span className="font-semibold">May 2025 – Jul 2025</span>
        </div>
        <p className="font-serif text-[12px] italic">
          Software Engineering Intern
        </p>

        <ul className="mt-2 flex flex-col gap-1.5 font-serif text-[12.5px] leading-snug">
          {bullets.map((bullet) => {
            const changed = step >= bullet.step
            const hidden = bullet.after === null && changed
            return (
              <motion.li
                key={bullet.step}
                layout
                className="relative flex gap-2 pl-1"
                // 0.6 keeps the struck line readable (4.5:1 contrast); the strike shows it's removed.
                animate={{ opacity: hidden ? 0.6 : 1 }}
                transition={{ duration: 0.4 }}
              >
                <span aria-hidden="true">•</span>
                <span
                  className={cn(
                    hidden && 'line-through decoration-neutral-500',
                  )}
                >
                  <motion.span
                    key={changed && bullet.after ? 'after' : 'before'}
                    initial={
                      changed && bullet.after ? { opacity: 0, y: 3 } : false
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {changed && bullet.after ? (
                      <Highlight active={changed}>{bullet.after}</Highlight>
                    ) : (
                      bullet.before
                    )}
                  </motion.span>
                </span>
              </motion.li>
            )
          })}
        </ul>

        <p className="mt-4 border-b border-neutral-800 pb-0.5 font-serif text-sm font-semibold [font-variant-caps:small-caps]">
          Technical Skills
        </p>
        <p className="mt-1.5 font-serif text-[12.5px]">
          <b>Languages</b>: Go, TypeScript, Python, SQL
        </p>
      </figure>

      <div
        className="mt-4 flex min-h-9 items-center justify-between gap-3 text-sm"
        aria-live="polite"
      >
        {done ? (
          <motion.p
            key={`done-${run}`}
            className="flex items-center gap-2"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-success text-background">
              <CheckIcon className="size-3.5" />
            </span>
            2 bullets rewritten, 1 hidden. All accepted by you.
          </motion.p>
        ) : (
          <p className="flex items-center gap-2 text-muted-foreground">
            <SparklesIcon className="size-4" />
            Matching your resume to the job…
          </p>
        )}
        {done && !reduceMotion && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRun((n) => n + 1)}
          >
            <RotateCcwIcon data-icon="inline-start" />
            Replay
          </Button>
        )}
      </div>
    </div>
  )
}
