import { redirect } from 'next/navigation';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const liffState = params?.['liff.state'];

  if (typeof liffState === 'string' && liffState.trim()) {
    let target = decodeURIComponent(liffState.trim());
    if (!target.startsWith('/')) target = '/' + target;
    redirect(target);
  }

  // เข้า / ตรงๆ จะส่งต่อไปยังหน้าจองคิว (/appointment) ทันที
  redirect('/login');
}
