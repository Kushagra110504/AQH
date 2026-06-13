'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../store/useAppStore';

export default function Home() {
  const router = useRouter();
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [user, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#070913]">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-violet-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4 text-slate-400 font-medium">Loading session...</p>
      </div>
    </div>
  );
}
