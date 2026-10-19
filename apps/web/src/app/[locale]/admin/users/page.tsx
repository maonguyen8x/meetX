'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Can, useSession } from '@/components/session/session-provider';
import { apiRequest } from '@/lib/api-client';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  status: string;
}

export default function AdminUsersPage() {
  const t = useTranslations('AdminUsers');
  const errors = useTranslations('Auth.errors');
  const { user: me } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const message = useCallback(
    (code?: string) => (code && errors.has(code) ? errors(code) : errors('UNKNOWN')),
    [errors],
  );

  const load = useCallback(async () => {
    const result = await apiRequest<{ items: AdminUser[] }>('/v1/admin/users?pageSize=100');
    if (result.ok) setUsers(result.data?.items ?? []);
    else setError(message(result.errorCode));
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(target: AdminUser) {
    const active = target.status === 'ACTIVE';
    const result = await apiRequest(`/v1/admin/users/${target.id}/${active ? 'deactivate' : 'activate'}`, {
      body: {},
    });
    setError(result.ok ? null : message(result.errorCode));
    await load();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const result = await apiRequest(data.get('kind') === 'admin' ? '/v1/admin/admins' : '/v1/admin/users', {
      body: { email: data.get('email'), name: data.get('name'), locale: 'vi' },
    });
    setError(result.ok ? null : message(result.errorCode));
    if (result.ok) form.reset();
    await load();
  }

  const input =
    'rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60';

  return (
    <section className="glass-panel rounded-3xl p-8">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t('title')}</h1>
      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <Can permission="users.create">
        <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={create}>
          <input className={input} name="name" placeholder={t('name')} required />
          <input className={input} name="email" placeholder={t('email')} required type="email" />
          <Can permission="admins.create">
            <select className={input} defaultValue="user" name="kind">
              <option value="user">{t('kindUser')}</option>
              <option value="admin">{t('kindAdmin')}</option>
            </select>
          </Can>
          <button className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white" type="submit">
            {t('create')}
          </button>
        </form>
      </Can>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">{t('name')}</th>
              <th>{t('email')}</th>
              <th>{t('role')}</th>
              <th>{t('status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr className="border-t border-white/50 dark:border-white/10" key={row.id}>
                <td className="py-2">{row.name}</td>
                <td>{row.email}</td>
                <td>{row.platformRole}</td>
                <td>{row.status}</td>
                <td className="text-right">
                  {row.id === me?.id ? null : (
                    <Can permission="users.activate">
                      <button className="text-teal-700 underline dark:text-teal-300" onClick={() => void toggle(row)} type="button">
                        {row.status === 'ACTIVE' ? t('deactivate') : t('activate')}
                      </button>
                    </Can>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
