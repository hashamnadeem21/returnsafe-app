import { Redirect } from 'expo-router';

/** Never shown: the raised Scan tab button opens the scanner modal instead. */
export default function ScanTab() {
  return <Redirect href="/scanner" />;
}
