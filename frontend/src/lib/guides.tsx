import { Link } from '@tanstack/react-router'
import type { DocSection } from '@/lib/docs'

export type Guide = {
  slug: string
  title: string
  // The <title> and search snippet; title is the on-page heading.
  seoTitle: string
  summary: string
  updated: string
  sections: DocSection[]
}

const T = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <Link to="/templates/$templateId" params={{ templateId: id }}>
    {children}
  </Link>
)

export const guides: Guide[] = [
  {
    slug: 'resume-format-for-freshers',
    title: 'Resume format for freshers',
    seoTitle: 'Resume Format for Freshers (2026): Section Order and Examples',
    summary:
      'The resume format that works for freshers and campus placements in India: what goes on the page, in what order, and what to leave out.',
    updated: '2026-10-05',
    sections: [
      {
        id: 'at-a-glance',
        title: 'The format at a glance',
        body: (
          <>
            <p>
              A fresher resume has one job: get you shortlisted for an
              interview. Recruiters spend well under a minute on a first read,
              and most use an applicant tracking system (ATS) to search and sort
              applications. The format below works for both.
            </p>
            <ul>
              <li>
                <strong>One page.</strong> Without full-time experience, a
                second page only dilutes your best points.
              </li>
              <li>
                <strong>Single column</strong>, with standard section headings.
              </li>
              <li>
                <strong>Education first</strong>, then skills, projects,
                internships and achievements.
              </li>
              <li>
                <strong>Newest first</strong> inside every section.
              </li>
              <li>
                <strong>A PDF</strong> with selectable text, unless the job post
                asks for Word.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: 'section-order',
        title: 'Section order for freshers',
        body: (
          <>
            <ol>
              <li>Name and contact details</li>
              <li>Education</li>
              <li>Skills</li>
              <li>Projects</li>
              <li>Internships or work experience</li>
              <li>Achievements and positions of responsibility</li>
              <li>Certifications (optional)</li>
            </ol>
            <p>
              If you have a solid internship, move it above projects. Once you
              have a full-time job, experience moves to the top and education
              goes to the bottom.
            </p>
          </>
        ),
      },
      {
        id: 'contact',
        title: 'Name and contact details',
        body: (
          <>
            <p>
              Put your name in large type, then one line with your phone number,
              a professional email address, your city, and links to LinkedIn and
              GitHub or a portfolio. Write links out in a short form like{' '}
              <code>github.com/aarav</code> so they still work on a printed
              copy.
            </p>
            <p>
              Leave out your photo, date of birth, gender, marital status,
              father's name and full postal address. Indian companies and
              recruiters abroad do not need them, and they take space from
              things that get you shortlisted.
            </p>
          </>
        ),
      },
      {
        id: 'education',
        title: 'Education',
        body: (
          <>
            <p>
              List your degree, college, CGPA or percentage, and year of
              graduation (or expected graduation). Most campus recruiters also
              expect Class XII and Class X, with the board and your percentage,
              until you have your first job. A table with degree, institution,
              score and year, like the{' '}
              <T id="campus">Campus placement template</T>, fits all of this in
              a few lines.
            </p>
            <p>
              Write your score the way your college reports it ("8.4 CGPA" or
              "86%"). Add a line of relevant coursework only if it matches the
              jobs you are applying for.
            </p>
          </>
        ),
      },
      {
        id: 'skills',
        title: 'Skills',
        body: (
          <>
            <p>
              Group skills by type so they are quick to scan, for example
              Languages, Frameworks, Tools and Databases. List only what you
              could answer interview questions on: a recruiter or interviewer
              will pick anything on the page and ask about it.
            </p>
            <p>
              Leave out soft skills like "hard-working" or "team player" here.
              Show them in your bullets instead ("Led a team of 4 to build…").
            </p>
          </>
        ),
      },
      {
        id: 'projects',
        title: 'Projects',
        body: (
          <>
            <p>
              For most freshers, projects are the strongest section. Pick your
              two or three best, and for each one give the name, the tech stack
              and a link to the code or a live demo. Then add two or three
              bullets that say what you built, how, and what came of it.
            </p>
            <p>A weak bullet and a strong one:</p>
            <ul>
              <li>Weak: "Made a food delivery website using React."</li>
              <li>
                Strong: "Built a food ordering app in React and Node.js with UPI
                payments; 120 students in my hostel used it in its first month."
              </li>
            </ul>
            <p>
              Numbers make a bullet believable: users, speed, accuracy, rank,
              time saved. Small, honest numbers are fine.
            </p>
          </>
        ),
      },
      {
        id: 'internships',
        title: 'Internships and experience',
        body: (
          <p>
            Give the company, your role, the dates and two to four bullets on
            what you did. Unpaid, remote and short internships all count, and so
            do freelance work and teaching assistant roles. Start each bullet
            with a verb (built, analysed, reduced, launched) and end it with a
            result where you can.
          </p>
        ),
      },
      {
        id: 'achievements',
        title: 'Achievements and positions of responsibility',
        body: (
          <p>
            This is where hackathons, coding contest ranks, scholarships, paper
            presentations and club roles go. Be specific: "Winner, Smart India
            Hackathon 2025 (team of 6)" or "Organised a 3-day tech fest with 40
            volunteers and 2,000 attendees" says far more than "Active member of
            the coding club".
          </p>
        ),
      },
      {
        id: 'leave-out',
        title: 'What to leave out',
        body: (
          <ul>
            <li>
              A generic career objective ("Seeking a challenging position…").
              Use a two-line summary only if it says something specific about
              you.
            </li>
            <li>
              The declaration line ("I hereby declare…") and your signature.
            </li>
            <li>"References available on request".</li>
            <li>Hobbies, unless they are unusual or relevant to the job.</li>
            <li>
              Skills ratings drawn as bars or stars; an ATS cannot read them.
            </li>
          </ul>
        ),
      },
      {
        id: 'formatting',
        title: 'Formatting rules',
        body: (
          <ul>
            <li>Font size 10 to 11 pt, with margins of about half an inch.</li>
            <li>One date format everywhere, like "Jun 2025" or "06/2025".</li>
            <li>
              No text inside images, icons or text boxes, and nothing important
              in the page header or footer.
            </li>
            <li>
              Name the file after yourself: <code>Aarav-Sharma-Resume.pdf</code>
              , not <code>resume_final_v3.pdf</code>.
            </li>
          </ul>
        ),
      },
      {
        id: 'template',
        title: 'A template that follows this format',
        body: (
          <>
            <p>
              The <T id="campus">Campus placement template</T> follows this
              format exactly, and <T id="jake">Jake's Resume</T> is the standard
              for software roles. Both are free on Shortlist: fill in a form or
              import your current resume, and it is typeset for you. When you
              apply, paste the job description to tailor the resume to that
              role.
            </p>
            <p>
              Before you send it, run it through the free{' '}
              <Link to="/ats-checker">ATS resume checker</Link> to catch
              anything a parser would trip on.
            </p>
          </>
        ),
      },
    ],
  },
  {
    slug: 'ats-friendly-resume',
    title: 'How to make an ATS-friendly resume',
    seoTitle: 'How to Make an ATS-Friendly Resume: Rules That Matter',
    summary:
      'What an applicant tracking system actually does with your resume, the formatting rules that keep it readable, and the myths you can ignore.',
    updated: '2026-10-05',
    sections: [
      {
        id: 'what-ats-does',
        title: 'What an ATS actually does',
        body: (
          <>
            <p>
              An applicant tracking system (ATS) is the software companies use
              to collect applications. Workday, Greenhouse, Lever,
              SuccessFactors and Naukri RMS are common ones. When you apply, the
              ATS reads your resume and fills fields like name, email, job
              titles, dates, education and skills. Recruiters then search and
              filter those fields, and many systems rank applicants against the
              job.
            </p>
            <p>
              Most of the time, an ATS does not reject resumes on its own.
              Rejections usually come from knockout questions on the application
              form (location, notice period, years of experience) or from a
              recruiter who never finds you in a search. So the goal has two
              parts: a resume the ATS reads correctly, and one that matches the
              words a recruiter searches for.
            </p>
          </>
        ),
      },
      {
        id: 'layout',
        title: 'Keep the layout simple',
        body: (
          <ul>
            <li>
              <strong>Use one column.</strong> Many parsers read straight across
              the page, so two columns can come out as lines from both sides
              mixed together.
            </li>
            <li>
              <strong>Use standard headings:</strong> Education, Experience,
              Projects, Skills. Clever names like "My Journey" may not be
              recognised as a section.
            </li>
            <li>
              <strong>Keep contact details in the main body</strong>, not in the
              page header or footer, which some systems skip.
            </li>
            <li>
              <strong>Avoid text in images, icons and text boxes.</strong> A
              phone icon with no number written next to it reads as nothing, or
              as a stray character.
            </li>
            <li>
              <strong>Avoid tables for important content.</strong> A simple
              education table usually parses fine; a full layout built from
              tables often does not.
            </li>
          </ul>
        ),
      },
      {
        id: 'file',
        title: 'Use a text-based PDF',
        body: (
          <p>
            Modern ATS software reads PDFs well, as long as the text is real
            text. Check by opening your PDF and trying to select a line. If you
            cannot, it was scanned or exported as an image, and the ATS will see
            an empty page. Export again from Word, Google Docs or LaTeX. Send a
            Word file only when the job post asks for one.
          </p>
        ),
      },
      {
        id: 'keywords',
        title: 'Match the job description',
        body: (
          <>
            <p>
              Recruiters search the ATS for skills and job titles. Read the job
              description and make sure the must-have skills it lists appear in
              your resume, in the same words, wherever they are true for you. If
              the post says "PostgreSQL", write PostgreSQL, not just "SQL
              databases".
            </p>
            <ul>
              <li>
                Write both forms of common acronyms once: "Machine Learning
                (ML)".
              </li>
              <li>
                Put skills in the bullets where you used them, not only in a
                skills list.
              </li>
              <li>
                Never paste the job description in white text or stuff keywords.
                Recruiters read the result, and it costs you more than it gains.
              </li>
            </ul>
            <p>
              Tailoring every application by hand is slow. Shortlist does it in
              one click: paste the job description and review each suggested
              change before you accept it. Any change that adds something it
              can't find in your resume or profile is flagged and left unchecked
              for you to decide.
            </p>
          </>
        ),
      },
      {
        id: 'details',
        title: 'Small details that break parsing',
        body: (
          <ul>
            <li>
              One date format throughout ("Jun 2024 to Present"), so the ATS can
              work out your experience.
            </li>
            <li>
              Standard fonts, and no letter-spaced names like "A A R A V".
            </li>
            <li>
              Write links in full or in short form (linkedin.com/in/aarav), not
              only as an icon.
            </li>
            <li>Plain bullets, not emoji or custom symbols.</li>
          </ul>
        ),
      },
      {
        id: 'myths',
        title: 'Myths you can ignore',
        body: (
          <ul>
            <li>
              <strong>"ATS software can't read PDFs."</strong> It could not, a
              long time ago. Text-based PDFs are fine today.
            </li>
            <li>
              <strong>"75% of resumes are rejected by the ATS."</strong> This
              figure has no real source. Most filtering is done by people and by
              the questions on the application form.
            </li>
            <li>
              <strong>"You need a perfect ATS score."</strong> There is no
              universal score; every company sets up its system differently. A
              checker tells you what to fix, not whether you will be hired.
            </li>
          </ul>
        ),
      },
      {
        id: 'check',
        title: 'Check your resume',
        body: (
          <p>
            The free <Link to="/ats-checker">ATS resume checker</Link> reads
            your PDF the way a parser does and shows what comes through, what
            breaks and how to fix it. No signup needed. If you are starting
            fresh, every <Link to="/templates">Shortlist template</Link> marked
            ATS-friendly follows these rules.
          </p>
        ),
      },
    ],
  },
]

export const findGuide = (slug: string) => guides.find((g) => g.slug === slug)
