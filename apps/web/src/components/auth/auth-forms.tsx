'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { Link, useRouter } from '@/i18n/navigation';
import { apiRequest } from '@/lib/api-client';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
      <section className="glass-panel w-full rounded-3xl p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

interface FieldProps {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}

function Field({ name, label, type = 'text', hint, required = true, ...rest }: FieldProps) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        className="mt-1 w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-teal-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-white"
        name={name}
        type={type}
        required={required}
        {...rest}
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      className="w-full rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {children}
    </button>
  );
}

function useAuthForm() {
  const t = useTranslations('Auth');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (code?: string) => {
    const key = `errors.${code ?? 'UNKNOWN'}`;
    return t.has(key) ? t(key) : t('errors.UNKNOWN');
  };

  async function submit(event: FormEvent<HTMLFormElement>, run: (data: FormData) => Promise<string | null>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const failure = await run(new FormData(event.currentTarget));
    if (failure) setError(message(failure));
    setPending(false);
  }

  return { t, pending, error, submit };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-200" role="alert">
      {error}
    </p>
  ) : null;
}

function str(data: FormData, key: string): string {
  return String(data.get(key) ?? '');
}

export function LoginForm() {
  const { t, pending, error, submit } = useAuthForm();
  const router = useRouter();

  return (
    <AuthCard title={t('login.title')} subtitle={t('login.subtitle')}>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          submit(event, async (data) => {
            const result = await apiRequest<{ user: { mustChangePassword: boolean } }>('/api/auth/login', {
              body: { email: str(data, 'email'), password: str(data, 'password') },
            });
            if (!result.ok) return result.errorCode ?? 'UNKNOWN';
            router.replace(result.data?.user.mustChangePassword ? '/change-password' : '/dashboard');
            return null;
          })
        }
      >
        <Field name="email" label={t('fields.email')} type="email" autoComplete="email" />
        <Field name="password" label={t('fields.password')} type="password" autoComplete="current-password" />
        <ErrorText error={error} />
        <SubmitButton pending={pending}>{t('login.submit')}</SubmitButton>
      </form>
      <div className="mt-5 flex justify-between text-sm text-teal-700 dark:text-teal-300">
        <Link href="/forgot-password">{t('login.forgot')}</Link>
        <Link href="/register">{t('login.register')}</Link>
      </div>
    </AuthCard>
  );
}

export function RegisterForm() {
  const { t, pending, error, submit } = useAuthForm();
  const locale = useLocale();
  const [business, setBusiness] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <AuthCard title={t('register.doneTitle')} subtitle={t('register.doneBody')}>
        <Link className="text-sm text-teal-700 dark:text-teal-300" href="/login">
          {t('backToLogin')}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('register.title')} subtitle={t('register.subtitle')}>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          submit(event, async (data) => {
            const result = await apiRequest('/v1/auth/register', {
              body: {
                name: str(data, 'name'),
                email: str(data, 'email'),
                password: str(data, 'password'),
                locale,
                accountKind: business ? 'business' : 'individual',
                ...(business ? { organizationName: str(data, 'organizationName') } : {}),
              },
            });
            if (!result.ok) return result.errorCode ?? 'UNKNOWN';
            setDone(true);
            return null;
          })
        }
      >
        <Field name="name" label={t('fields.name')} autoComplete="name" />
        <Field name="email" label={t('fields.email')} type="email" autoComplete="email" />
        <Field
          name="password"
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          minLength={12}
          hint={t('fields.passwordHint')}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input checked={business} onChange={(event) => setBusiness(event.target.checked)} type="checkbox" />
          {t('register.business')}
        </label>
        {business ? <Field name="organizationName" label={t('fields.organizationName')} /> : null}
        <ErrorText error={error} />
        <SubmitButton pending={pending}>{t('register.submit')}</SubmitButton>
      </form>
      <div className="mt-5 text-sm text-teal-700 dark:text-teal-300">
        <Link href="/login">{t('backToLogin')}</Link>
      </div>
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const { t, pending, error, submit } = useAuthForm();
  const [done, setDone] = useState(false);

  return (
    <AuthCard title={t('forgot.title')} subtitle={done ? t('forgot.done') : t('forgot.subtitle')}>
      {done ? null : (
        <form
          className="space-y-4"
          onSubmit={(event) =>
            submit(event, async (data) => {
              const result = await apiRequest('/v1/auth/forgot-password', { body: { email: str(data, 'email') } });
              if (!result.ok) return result.errorCode ?? 'UNKNOWN';
              setDone(true);
              return null;
            })
          }
        >
          <Field name="email" label={t('fields.email')} type="email" autoComplete="email" />
          <ErrorText error={error} />
          <SubmitButton pending={pending}>{t('forgot.submit')}</SubmitButton>
        </form>
      )}
      <div className="mt-5 text-sm text-teal-700 dark:text-teal-300">
        <Link href="/login">{t('backToLogin')}</Link>
      </div>
    </AuthCard>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { t, pending, error, submit } = useAuthForm();
  const router = useRouter();
  const [done, setDone] = useState(false);

  return (
    <AuthCard title={t('reset.title')} subtitle={done ? t('reset.done') : t('reset.subtitle')}>
      {done ? (
        <button
          className="w-full rounded-xl bg-teal-600 px-4 py-2.5 font-semibold text-white"
          onClick={() => router.replace('/login')}
          type="button"
        >
          {t('backToLogin')}
        </button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) =>
            submit(event, async (data) => {
              const result = await apiRequest('/v1/auth/reset-password', {
                body: { token, password: str(data, 'password') },
              });
              if (!result.ok) return result.errorCode ?? 'UNKNOWN';
              setDone(true);
              return null;
            })
          }
        >
          <Field
            name="password"
            label={t('fields.newPassword')}
            type="password"
            autoComplete="new-password"
            minLength={12}
            hint={t('fields.passwordHint')}
          />
          <ErrorText error={error} />
          <SubmitButton pending={pending}>{t('reset.submit')}</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}

export function VerifyEmailStatus({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const [state, setState] = useState<'pending' | 'ok' | 'failed'>('pending');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void apiRequest('/v1/auth/verify-email', { body: { token } }).then((result) =>
      setState(result.ok ? 'ok' : 'failed'),
    );
  }, [token]);

  return (
    <AuthCard title={t('verify.title')} subtitle={t(`verify.${state}`)}>
      {state === 'pending' ? null : (
        <Link className="text-sm text-teal-700 dark:text-teal-300" href="/login">
          {t('backToLogin')}
        </Link>
      )}
    </AuthCard>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const { t, pending, error, submit } = useAuthForm();
  const locale = useLocale();
  const router = useRouter();

  return (
    <AuthCard title={t('invite.title')} subtitle={t('invite.subtitle')}>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          submit(event, async (data) => {
            const result = await apiRequest('/v1/orgs/invitations/accept', {
              body: { token, locale, name: str(data, 'name'), password: str(data, 'password') },
            });
            if (!result.ok) return result.errorCode ?? 'UNKNOWN';
            router.replace('/login');
            return null;
          })
        }
      >
        <Field name="name" label={t('fields.name')} autoComplete="name" />
        <Field
          name="password"
          label={t('fields.password')}
          type="password"
          autoComplete="new-password"
          minLength={12}
          hint={t('fields.passwordHint')}
        />
        <ErrorText error={error} />
        <SubmitButton pending={pending}>{t('invite.submit')}</SubmitButton>
      </form>
      <p className="mt-4 text-xs text-slate-500">{t('invite.existing')}</p>
    </AuthCard>
  );
}

export function ChangePasswordForm() {
  const { t, pending, error, submit } = useAuthForm();
  const router = useRouter();

  return (
    <AuthCard title={t('change.title')} subtitle={t('change.subtitle')}>
      <form
        className="space-y-4"
        onSubmit={(event) =>
          submit(event, async (data) => {
            const result = await apiRequest('/v1/auth/change-password', {
              body: { currentPassword: str(data, 'currentPassword'), newPassword: str(data, 'newPassword') },
            });
            if (!result.ok) return result.errorCode ?? 'UNKNOWN';
            router.replace('/dashboard');
            return null;
          })
        }
      >
        <Field name="currentPassword" label={t('fields.currentPassword')} type="password" autoComplete="current-password" />
        <Field
          name="newPassword"
          label={t('fields.newPassword')}
          type="password"
          autoComplete="new-password"
          minLength={12}
          hint={t('fields.passwordHint')}
        />
        <ErrorText error={error} />
        <SubmitButton pending={pending}>{t('change.submit')}</SubmitButton>
      </form>
    </AuthCard>
  );
}
