import { setRequestLocale } from 'next-intl/server';

import { ResetPasswordForm } from '@/components/auth/auth-forms';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps) {
  setRequestLocale((await params).locale);
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ''} />;
}
