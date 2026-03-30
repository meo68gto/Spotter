import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSessionCookieName } from '../../../admin-session';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(getAdminSessionCookieName());
  cookieStore.delete('admin_token');
  return NextResponse.redirect(new URL('/', process.env.APP_URL ?? 'http://localhost:3000'));
}
