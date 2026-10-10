'use client';
import { Button } from '@glasswork/ui/components/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      <LogOut size={16} aria-hidden /> Log out
    </Button>
  );
}
