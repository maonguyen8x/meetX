import { setRequestLocale } from 'next-intl/server';

import { RegisterForm } from '@/components/auth/auth-forms';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <RegisterForm />;
}
