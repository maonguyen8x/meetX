import { redirect } from '@/i18n/navigation';

export default async function AdminIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  redirect({ href: '/admin/users', locale: (await params).locale });
}
