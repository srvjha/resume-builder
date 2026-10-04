import { useId } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Native <details> keeps every answer in the page HTML, where search engines and Ctrl+F find it;
// a closed Radix accordion renders nothing. A shared name keeps one answer open at a time.
export function FaqList({
  faqs,
  className,
}: {
  faqs: readonly { q: string; a: React.ReactNode }[]
  className?: string
}) {
  const name = useId()
  return (
    <div className={cn('flex w-full flex-col', className)}>
      {faqs.map((faq) => (
        <details key={faq.q} name={name} className="group not-last:border-b">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg py-2.5 font-sans text-base font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
            {faq.q}
            <ChevronDownIcon
              aria-hidden
              className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="pb-2.5 text-base text-muted-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4">
            {faq.a}
          </div>
        </details>
      ))}
    </div>
  )
}
