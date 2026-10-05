// A fixed before and after for each check, shown under its fix. Never about the user's own resume.
export const checkExamples: Partial<
  Record<string, { before: string; after: string }>
> = {
  'action-verbs': {
    before: 'Responsible for the payment module',
    after: 'Built the payment module in Go, used by 2M customers a month',
  },
  quantified: {
    before: 'Improved the website speed',
    after: 'Cut page load time from 4s to 1.2s for 50k monthly visitors',
  },
  'bullet-length': {
    before:
      'Worked on the backend team where I handled many tasks including APIs, database work and helping the frontend team with integration issues whenever needed',
    after: 'Built 12 REST APIs in Node.js and PostgreSQL for the checkout flow',
  },
  'first-person': {
    before: 'I developed a chatbot for my college',
    after:
      'Developed a college helpdesk chatbot that answers 300 questions a week',
  },
  cliches: {
    before: 'Hard-working team player with good communication skills',
    after:
      'Led a team of 4 to ship the fest website in 3 weeks for 2,000 visitors',
  },
  'repeated-openers': {
    before: 'Developed the API · Developed tests · Developed the dashboard',
    after: 'Built the API · Automated tests · Designed the dashboard',
  },
  'date-format': {
    before: 'Summer 2023 · 06/2022 - 2023',
    after: 'Jun 2023 - Aug 2023 · Jun 2022 - Mar 2023',
  },
  'title-headline': {
    before: 'Aarav Sharma / B.Tech CSE, 2025',
    after: 'Aarav Sharma / Backend Engineer, Go and PostgreSQL',
  },
  acronyms: {
    before: 'ML, NLP, CI/CD',
    after: 'Machine Learning (ML), Natural Language Processing (NLP), CI/CD',
  },
  'file-name': {
    before: 'resume_final_v3 (2).pdf',
    after: 'Aarav-Sharma-Resume.pdf',
  },
  'hidden-links': {
    before: 'Portfolio (a link behind the word)',
    after: 'aarav.dev',
  },
  linkedin: {
    before: 'No LinkedIn, or only an icon linking to it',
    after: 'linkedin.com/in/aarav-sharma',
  },
  'email-address': {
    before: 'coolboy.123@gmail.com',
    after: 'aarav.sharma@gmail.com',
  },
  gaps: {
    before:
      'Software Engineer, Acme (Jan 2021 - Dec 2022), then nothing until 2024',
    after:
      'Career break: AWS certification and freelance work, Jan 2023 - Dec 2023',
  },
  'keyword-stuffing': {
    before:
      'Python, Python, Python developer, Python scripts, Python automation',
    after: 'Python in Skills, plus the 2 bullets where you used it',
  },
}
