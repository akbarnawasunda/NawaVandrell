import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import AdminLogin from '@/components/AdminLogin';
import { ADMIN_SESSION_COOKIE, isConfigured, verifyAdminSessionValue } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default function AdminLoginPage() {
  if (!isConfigured()) notFound();
  const session = cookies().get(ADMIN_SESSION_COOKIE)?.value || '';
  if (verifyAdminSessionValue(session)) redirect('/admin');
  return <AdminLogin />;
}
