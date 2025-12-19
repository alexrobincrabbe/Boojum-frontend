import { useEffect, useState } from 'react';

export function useGuestName(isGuest: boolean): [string, boolean] {
  const [guestName, setGuestName] = useState<string>('');

  useEffect(() => {
    if (!isGuest) {
      setGuestName('');
      return;
    }

    const existing = localStorage.getItem('guest_name');
    if (existing) {
      setGuestName(existing);
      return;
    }

    const name = `Guest_${
      crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10)
    }`;

    localStorage.setItem('guest_name', name);
    setGuestName(name);
  }, [isGuest]);

  // guestReady helps avoid connecting before guestName exists
  const guestReady = !isGuest || !!guestName;

  return [guestName, guestReady];
}

