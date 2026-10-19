'use client';

import { useTranslations } from 'next-intl';

import { useSession } from '@/components/session/session-provider';

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const { user, memberships } = useSession();

  return (
    <section className="glass-panel rounded-3xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
        {t('welcome', { name: user?.name ?? '' })}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {t('role', { role: user ? t(`roles.${user.platformRole}`) : '' })}
      </p>
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
        {t('organizations')}
      </h2>
      {memberships.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{t('noOrganizations')}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {memberships.map((membership) => (
            <li key={membership.organizationId}>
              {membership.name} — {t(`orgRoles.${membership.orgRole}`)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
