import { setRequestLocale } from 'next-intl/server';

import { ChangePasswordForm } from '@/components/auth/auth-forms';

export default async function ChangePasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ChangePasswordForm />;
}
