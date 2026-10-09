import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
import { ADMIN_SESSION_COOKIE, isConfigured, verifyAdminSessionValue } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export default function AdminPage() {
  if (!isConfigured()) notFound();
  const session = cookies().get(ADMIN_SESSION_COOKIE)?.value || '';
  if (!verifyAdminSessionValue(session)) notFound();
  return <AdminDashboard />;
}
