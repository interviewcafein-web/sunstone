import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

const CONTACT = '93mishra@gmail.com';
const UPDATED = '27 October 2026';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

/** Public privacy policy (also the one Google's sign-in consent screen links to). */
export default function PrivacyPage() {
  return (
    <article className="shadow-card bg-surface mx-auto max-w-3xl space-y-6 rounded-2xl border border-slate-200 p-6 sm:p-8">
      <header>
        <p className="text-brand-700 dark:text-brand-300 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase">
          <ShieldCheck className="size-4" aria-hidden />
          Privacy policy
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          Sunstone PRIME Vertex
        </h1>
        <p className="mt-1 text-sm text-slate-500">Last updated {UPDATED}</p>
      </header>

      <Section title="What Vertex is">
        <p>
          Sunstone PRIME Vertex is a dashboard used by the Sunstone PRIME team to follow
          students&apos; coding practice across platforms such as LeetCode, GeeksforGeeks,
          HackerRank, Codeforces, CodeChef and GitHub, and to share each student&apos;s coding
          profile.
        </p>
      </Section>

      <Section title="Information we use">
        <p>
          <strong>Students.</strong> Name, campus, course, batch and enrolment status from the
          Sunstone learning platform, and the coding-platform usernames students submit through the
          Sunstone PRIME form. We read the public profile statistics of those usernames from each
          platform and keep the latest figures to show progress.
        </p>
        <p>
          <strong>Staff who sign in.</strong> When you sign in with Google, we receive your name and
          email address from Google, and use them only to check that your email has been given
          access and to show who is signed in. We do not receive or store your Google password, and
          we do not access your Gmail, Drive, contacts or any other Google data. When you sign in
          with an emailed code, we use your email address only to send the code.
        </p>
      </Section>

      <Section title="How it is used and shared">
        <p>
          Information is used only to run Vertex for Sunstone PRIME: showing student progress to
          Sunstone staff and letting students share their own coding profile. Staff see only the
          campuses they have been given access to. We do not sell information or use it for
          advertising.
        </p>
        <p>
          Contact details (email addresses and phone numbers) are never shown on public profile
          pages. A student&apos;s public profile shows their name, campus, course and coding
          statistics.
        </p>
        <p>
          Vertex is hosted on Vercel and stores data in a Neon Postgres database; sign-in codes are
          sent by email through Resend. These providers process data only to provide their service.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          A single sign-in cookie keeps staff signed in for up to seven days. It is not used for
          tracking or advertising.
        </p>
      </Section>

      <Section title="Keeping and removing information">
        <p>
          Student information is kept while the student is enrolled in Sunstone PRIME. Staff access
          can be removed at any time by a Sunstone administrator. To ask what we hold about you, or
          to have it corrected or removed, contact us below.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy:{' '}
          <a
            href={`mailto:${CONTACT}`}
            className="text-brand-700 dark:text-brand-300 font-semibold hover:underline"
          >
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
