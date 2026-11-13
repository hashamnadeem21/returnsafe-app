import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { deviceTimezone, todayIn, type IsoDate } from '@/lib/dates';

import { useReceipts } from './receiptsStore';

/** The user's time zone: the one saved on their account, else the device's. */
export function useTimezone(): string {
  return useReceipts((s) => s.profile?.timezone) ?? deviceTimezone();
}

/** Today's date in the user's time zone; updates each minute and when the app comes back. */
export function useToday(): IsoDate {
  const tz = useTimezone();
  const [today, setToday] = useState(() => todayIn(tz));
  useEffect(() => {
    const refresh = () => setToday(todayIn(tz));
    refresh();
    const t = setInterval(refresh, 60_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [tz]);
  return today;
}
