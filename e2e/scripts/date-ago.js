/* global output, DAYS_AGO */
// The date DAYS_AGO days before today (device and host share a clock and time zone):
// output.monthsBack (calendar pages to go back), output.monthDay ("August 24", iOS) and
// output.androidDay ("24 August 2026").
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const now = new Date();
const then = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(DAYS_AGO));
output.monthsBack =
  (now.getFullYear() - then.getFullYear()) * 12 + now.getMonth() - then.getMonth();
output.monthDay = `${MONTHS[then.getMonth()]} ${then.getDate()}`;
output.day = `${then.getDate()}`;
output.year = `${then.getFullYear()}`;
// Android day cells read "04 August 2026".
output.androidDay = `${then.getDate() < 10 ? '0' : ''}${then.getDate()} ${MONTHS[then.getMonth()]} ${then.getFullYear()}`;
