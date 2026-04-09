'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function RedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings?tab=videos'); }, [router]);
  return null;
}
