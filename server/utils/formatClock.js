/**
 * Format a Date into display-ready clock parts (local time).
 *
 * @param {Date} date
 * @returns {{ time: string, date: string }} time as "HH:MM", date as "YYYY-MM-DD"
 */
export function formatClock(date) {
  const pad = (n) => String(n).padStart(2, '0');

  return {
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
  };
}
