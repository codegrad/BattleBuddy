import { useMemo } from 'react';

export function useGreeting(): string {
  return useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return "Still up? I'm here if you need me.";
    if (hour < 12) return 'Good morning — ready when you are.';
    if (hour < 17) return "Afternoon check-in. How's it going?";
    if (hour < 21) return "Evening. I'm right here.";
    return "Late night. I've got you.";
  }, []);
}
