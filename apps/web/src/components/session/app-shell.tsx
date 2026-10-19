'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { Link, useRouter } from '@/i18n/navigation';
import { Can, SessionProvider, useSession } from '@/components/session/session-provider';

function Shell({ children }: { children: ReactNode }) {
  const t = useTranslations('Shell');
  const router = useRouter();
  const { status, user, signOut } = useSession();

  useEffect(() => {
    if (status === 'authenticated' && user?.mustChangePassword) router.replace('/change-password');
  }, [status, user, router]);

  if (status !== 'authenticated') {
    return <p className="p-8 text-slate-600 dark:text-slate-300">{t('loading')}</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Link href="/dashboard">{t('dashboard')}</Link>
          <Can permission="users.read">
            <Link href="/admin/users">{t('admin')}</Link>
          </Can>
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span>{user?.name}</span>
          <button className="rounded-lg border border-teal-600 px-3 py-1 text-teal-700 dark:text-teal-300" onClick={() => void signOut()} type="button">
            {t('signOut')}
          </button>
        </div>
      </header>
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Shell>{children}</Shell>
    </SessionProvider>
  );
}
