import type { TemplateId } from '@/lib/templates'

// Copy for each template's own page at /templates/<id>: the search phrase it targets, who it suits,
// what the layout includes and how to fill it in.
export const templatePages: Record<
  TemplateId,
  { heading: string; intro: string; includes: string[]; tips: string[] }
> = {
  developer: {
    heading: 'Software Engineer Resume Template',
    intro:
      "The layout most Indian developers already know from Overleaf: Jake's Resume with a small-caps name and link icons for GitHub, LinkedIn and LeetCode. It suits freshers applying for SDE roles as well as engineers with a few years of experience.",
    includes: [
      'Contact line with icons for email, phone, GitHub and LinkedIn',
      'Experience with the company above a bold role and dates on the right',
      'Projects with Live and GitHub links next to the name and the tech stack on one line',
      'A grouped skills block: languages, frameworks, tools',
    ],
    tips: [
      'Put projects above experience if you only have one short internship.',
      'Start every bullet with a verb and end it with a result: "Cut page load from 4s to 1.2s".',
      'List only the skills you could answer interview questions on.',
    ],
  },
  jake: {
    heading: "Jake's Resume Template",
    intro:
      "Jake Gutierrez's single-column template is the most copied tech resume on the internet, and for good reason: it is plain, dense and easy for both recruiters and ATS software to read. Here it comes without the Overleaf setup.",
    includes: [
      'Centered name with contact details and links on one line',
      'Education, experience, projects and skills in the classic order',
      'Bold titles with dates and locations flush right',
      'Tight one-page spacing at 11 pt',
    ],
    tips: [
      'Freshers usually keep education first; move it down once you have a full-time job.',
      'Keep each bullet to one or two lines.',
      'Use the same date format everywhere, like "Jun 2025".',
    ],
  },
  sb2nov: {
    heading: 'Compact One-Page Resume Template',
    intro:
      'A denser take on the sb2nov resume, with your name on the left and contact details on the right. It fits more on one page, which helps when you have several projects, internships and achievements but still want a single page.',
    includes: [
      'Name left, email, phone and links right',
      'Compact section spacing at 10 pt',
      'Room for more projects and roles without spilling onto page two',
      'Skills grouped by type',
    ],
    tips: [
      'Dense does not mean crowded: cut weak bullets before you shrink spacing.',
      'Pick your three strongest projects; recruiters rarely read a fifth.',
      'Check the PDF at 100% zoom to make sure it is still easy to read.',
    ],
  },
  modern: {
    heading: 'Modern Resume Template',
    intro:
      'Inspired by Awesome-CV: clean sans-serif type with teal section headings in a single column. It looks current without the columns and graphics that confuse ATS software, so it works for tech, product and design applications.',
    includes: [
      'Sans-serif type with accent-colored section titles',
      'Single column, so ATS software reads it in order',
      'Experience, projects, education and skills sections',
      'Links written out in full so they survive printing',
    ],
    tips: [
      'Let the color do the styling; avoid adding bold to every line.',
      'A two-line summary works well here if you are switching fields.',
      'Keep it to one page unless you have more than eight years of experience.',
    ],
  },
  'ml-research': {
    heading: 'ML Research CV Template',
    intro:
      'An academic-leaning CV for machine learning engineers and researchers. Any list section titled Publications or Papers becomes numbered, citation-style entries, which makes it a good fit for research internships, MS and PhD applications and ML roles.',
    includes: [
      'Serif type with small-caps headings and a leader rule',
      'Numbered, citation-style publications',
      'Sections for research experience, projects, awards and teaching',
      'Room for advisors, venues and arXiv links',
    ],
    tips: [
      'Bold your own name in each publication so it stands out.',
      'For each project, name the dataset, the model and the metric you moved.',
      'Put preprints and under-review papers in the list, labelled as such.',
    ],
  },
  'data-analyst': {
    heading: 'Data Analyst Resume Template',
    intro:
      'A dense sans-serif layout for data analysts and data scientists. Section headings carry an accent bar, skills read like a key and value list, and dates and locations are muted so the numbers in your bullets stand out.',
    includes: [
      'Two-column skills block: SQL, Python, BI tools, statistics',
      'Muted metadata so results come first',
      'Experience and projects with space for metrics',
      'Certifications such as Google Data Analytics or Power BI',
    ],
    tips: [
      'Every bullet should have a number: rows, time saved, revenue, accuracy.',
      'Name the tools in the bullet itself: "Built a Power BI dashboard used by 40 store managers".',
      'Freshers can lead with two or three end-to-end projects using public datasets.',
    ],
  },
  'product-manager': {
    heading: 'Product Manager Resume Template',
    intro:
      'A roomy, outcome-first layout for product managers and APM applicants: a heavy accent rule under your name, sentence-case headings, company names in color and square bullets that keep each result on its own line.',
    includes: [
      'Header with a strong accent rule',
      'Company names in the accent color, roles below',
      'Square bullets with room for outcomes and metrics',
      'Sections for experience, projects, education and skills',
    ],
    tips: [
      'Write what changed for users or the business, not the features you shipped.',
      'APM applicants: case competitions and side products count as experience.',
      'Show the team you worked with: "with 4 engineers and a designer".',
    ],
  },
  designer: {
    heading: 'UI/UX Designer Resume Template',
    intro:
      'A two-column layout for UI/UX and product designers. A narrow sidebar holds contact details, skills, tools and education, and the main column tells the story of your work. Columns can trip up some ATS software, so use it where a person reads your resume first, like portfolio-led applications.',
    includes: [
      'Light display name and a narrow sidebar',
      'Sidebar for contact, portfolio link, tools and education',
      'Main column for experience and case studies',
      'Both columns can continue onto a second page',
    ],
    tips: [
      'Your portfolio link is the most important line: put it at the top.',
      'Describe the problem and the result for each project, not just the screens.',
      'For job portals with strict ATS checks, switch to the Modern template; your content carries over.',
    ],
  },
  campus: {
    heading: 'Campus Placement Resume Template for Freshers',
    intro:
      'The format placement cells in Indian colleges ask for: education first, as a table of degree, institution, score and year, then projects, internships, achievements and positions of responsibility in a dense single column. Built for B.Tech, BCA, MCA, B.Com and MBA students.',
    includes: [
      'Education table with CGPA or percentage for degree, Class XII and Class X',
      'Shaded section bars that are easy to scan',
      'Projects, internships, achievements and positions of responsibility',
      'Fits on one page at 10 pt',
    ],
    tips: [
      'Write the score the way your college does: "8.4 CGPA" or "86%".',
      'Hackathons, coding contests and club roles belong in Achievements and Positions of responsibility.',
      'Skip the photo, date of birth and declaration line; recruiters do not need them.',
    ],
  },
  banking: {
    heading: 'Investment Banking Resume Template',
    intro:
      'The dense one-page Wall Street layout banks expect: Times-style serif, firm names in bold with locations and dates flush right, and uppercase ruled headings. Education leads for students applying to IB, markets and finance internships.',
    includes: [
      'Education first with GPA, relevant coursework and honors',
      'Firm, location and dates on one line, role below',
      'Tight spacing that fits a full page of deals and results',
      'Skills, certifications and interests at the bottom',
    ],
    tips: [
      'Quantify deals and models: deal size, sector, what your analysis changed.',
      'List CFA levels and financial modelling courses under certifications.',
      'Interests are read here: keep two or three specific ones.',
    ],
  },
  finance: {
    heading: 'Finance and Accounting Resume Template',
    intro:
      'For corporate finance, audit and CA, CFA or CMA candidates: a Palatino-style serif with navy small-caps headings, your credentials under your name and certifications right after the summary, where recruiters look for them first.',
    includes: [
      'Credentials line under the name, like "CA Inter, CFA Level I"',
      'Certifications near the top',
      'Experience with articleship, audit and reporting work',
      'Education with scores and ranks',
    ],
    tips: [
      'Articleship counts as experience; list the clients and areas you covered.',
      'Name the tools: Tally, SAP, Excel and Power BI.',
      'Mention exam attempts only when they help, such as an all-India rank.',
    ],
  },
  consulting: {
    heading: 'Consulting Resume Template',
    intro:
      'A clean one-page consulting layout: humanist sans-serif, letterspaced headings under a heavy rule, firm and dates on one line with the role below, and square bullets for impact-first results. Education leads early on for MBA and campus applicants.',
    includes: [
      'Firm and dates on one line, role below',
      'Square bullets built for action, result and number',
      'Education early for MBA and campus roles',
      'Leadership and extracurriculars section',
    ],
    tips: [
      'Lead each bullet with the result, then how you got it.',
      'Case competitions and live projects show the same skills firms test for.',
      'Keep it to exactly one page; consulting recruiters are strict about it.',
    ],
  },
  marketing: {
    heading: 'Marketing and Sales Resume Template',
    intro:
      'A friendly sans-serif layout for marketing, sales and growth roles, with a warm accent on the tagline and section markers. The summary sits up top so your results, like growth, pipeline and revenue, are the first thing a recruiter reads.',
    includes: [
      'Tagline and short summary under the name',
      'Accent markers on headings, companies and bullets',
      'Experience with space for campaign and sales results',
      'Skills for tools like Google Ads, HubSpot and Excel',
    ],
    tips: [
      'Numbers win here: leads, conversion, quota attainment, follower growth.',
      'Freshers can use college fests, internships and social pages they ran.',
      'Keep the tagline specific: "B2B growth marketer" beats "Passionate marketer".',
    ],
  },
  executive: {
    heading: 'Executive Resume Template',
    intro:
      'An elegant Garamond layout for senior leaders: a centered small-caps name over a double rule, a summary and core competencies first, then career history with roles grouped under each company, board positions and education.',
    includes: [
      'Summary and a keyword block of core competencies',
      'Several roles grouped under one company',
      'Board roles and advisory positions',
      'Room for two pages of history',
    ],
    tips: [
      'Lead with scale: team size, budget, revenue you owned.',
      'Keep early-career roles to a single line each.',
      'Two pages is normal at this level; one page of summary and recent roles still matters most.',
    ],
  },
}
