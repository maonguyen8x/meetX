import { setRequestLocale } from 'next-intl/server';

import { ForgotPasswordForm } from '@/components/auth/auth-forms';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <ForgotPasswordForm />;
}
