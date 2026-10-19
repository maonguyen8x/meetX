import { setRequestLocale } from 'next-intl/server';

import { VerifyEmailStatus } from '@/components/auth/auth-forms';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ params, searchParams }: PageProps) {
  setRequestLocale((await params).locale);
  const { token } = await searchParams;
  return <VerifyEmailStatus token={token ?? ''} />;
}
