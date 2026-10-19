import { setRequestLocale } from 'next-intl/server';

import { AcceptInviteForm } from '@/components/auth/auth-forms';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitePage({ params, searchParams }: PageProps) {
  setRequestLocale((await params).locale);
  const { token } = await searchParams;
  return <AcceptInviteForm token={token ?? ''} />;
}
