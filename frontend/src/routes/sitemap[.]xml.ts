import { createFileRoute } from '@tanstack/react-router'
import { docs } from '@/lib/docs'
import { site } from '@/lib/site'

// Public pages only. Share links stay out: their owners decide whether they're found.
const paths = [
  '/',
  '/templates',
  '/ats-checker',
  '/pricing',
  '/docs',
  ...docs.map((doc) => `/docs/${doc.slug}`),
  '/privacy',
  '/terms',
]

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
            .map((path) => `  <url><loc>${site.url}${path}</loc></url>`)
            .join('\n')}\n</urlset>\n`,
          {
            headers: {
              'content-type': 'application/xml; charset=utf-8',
              'cache-control': 'public, max-age=3600',
            },
          },
        ),
    },
  },
})
