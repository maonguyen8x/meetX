import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

interface HomePageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations('Home');

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
      <section className="glass-panel w-full rounded-3xl p-8 sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {t('eyebrow')}
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
          {t('title')}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
          {t('description')}
        </p>
        <div className="mt-9 flex flex-wrap gap-3" aria-label={t('availableLanguages')}>
          {(['vi', 'en', 'ja'] as const).map((language) => (
            <span
              className="rounded-full border border-white/70 bg-white/50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-200"
              key={language}
            >
              {language.toUpperCase()}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
