import type { LucideIcon } from 'lucide-react';
import { Bell, Building2, Download, Radar, ShieldCheck, Users, WifiOff } from 'lucide-react';

import { VertexLogo } from '@/components/common/VertexLogo';

/**
 * Always the newest app: /app/vertex.apk redirects (vercel.json) to the APK attached to the
 * latest release of this repository, so publishing a new release updates this link.
 */
export const APK_URL = '/app/vertex.apk';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Users,
    title: 'Every student',
    text: 'Coding, Prime Mock Tests, AMCAT, exams and attendance',
  },
  { icon: Building2, title: 'Every campus', text: 'The full PRIME journey, tab by tab' },
  { icon: Radar, title: '360° view', text: 'Campuses and batches compared, pain points first' },
  { icon: Bell, title: 'Notifications', text: 'HQ announcements, new tests and weekly reports' },
  { icon: WifiOff, title: 'Fast, even offline', text: 'Opens at once with your last data' },
];

const STEPS = [
  'Open this page on your Android phone and tap Download.',
  'Open the downloaded file. If asked, allow “Install unknown apps” for your browser.',
  'If Play Protect warns you, tap “Install anyway”: Vertex is our internal app, not on the Play Store.',
  'Open Vertex, sign in with your work email (or Google), and allow notifications.',
];

export default function AppDownloadPage() {
  return (
    <div className="rise-stagger mx-auto max-w-4xl space-y-6">
      <section className="hero-glow from-brand-700 via-brand-700 to-brand-900 relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-[0_20px_50px_-20px_rgb(16_38_70/0.6)] sm:p-10">
        <div className="relative grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <VertexLogo onDark className="h-12" />
            <h1 className="mt-6 text-3xl leading-tight font-bold sm:text-4xl">
              Vertex, now on your phone.
            </h1>
            <p className="text-brand-100 mt-3 max-w-md">
              Every student&rsquo;s climb, in one view: the Sunstone PRIME team&rsquo;s app for
              Android.
            </p>
            <a
              href={APK_URL}
              className="mt-7 inline-flex items-center gap-2.5 rounded-2xl bg-[#e8a33d] px-6 py-3.5 text-base font-bold text-[#1a1206] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <Download className="size-5" aria-hidden />
              Download for Android
            </a>
            <p className="text-brand-200 mt-3 flex items-center gap-1.5 text-xs">
              <ShieldCheck className="size-3.5" aria-hidden />
              For Sunstone PRIME staff: sign-in needs a work email with access. iPhone coming soon.
            </p>
          </div>
          <div className="mx-auto hidden w-56 md:block" aria-hidden>
            <div className="rounded-[2.2rem] border-4 border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur">
              <div className="from-brand-600 to-brand-900 flex aspect-[9/17] flex-col items-center justify-center gap-4 rounded-[1.6rem] bg-gradient-to-b">
                <img src="/vertex-mark.png" alt="" className="size-20 rounded-2xl bg-white p-3" />
                <span className="text-sm font-semibold text-white/80">Vertex</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="shadow-card bg-surface hover-lift rounded-2xl border border-slate-200 p-4"
          >
            <span className="bg-brand-500/10 text-brand-700 dark:text-brand-300 flex size-10 items-center justify-center rounded-xl">
              <Icon className="size-5" aria-hidden />
            </span>
            <p className="mt-3 font-semibold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{text}</p>
          </div>
        ))}
      </section>

      <section className="shadow-card bg-surface rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold">How to install</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="bg-brand-700 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="pt-0.5 text-sm text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
