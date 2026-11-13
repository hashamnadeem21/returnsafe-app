import { fireEvent, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import {
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  CountdownRing,
  EmptyState,
  Icon,
  ListRow,
  Pill,
  ProLock,
  ScreenHeader,
  Sheet,
  Skeleton,
  TextField,
  toneForDaysLeft,
} from '@/components';
import type { ColorScheme } from '@/theme';

import { renderWithTheme } from '@/test/render';

const noop = () => {};

const cases: [string, ReactElement][] = [
  ['AppText', <AppText key="t">Hello</AppText>],
  ['Button', <Button key="b" label="Go" onPress={noop} />],
  ['TextField', <TextField key="f" label="Email" helper="We never share it" />],
  ['TextField error', <TextField key="fe" label="Email" error="Enter a valid email" />],
  ['TextField secure', <TextField key="fs" label="Password" secure />],
  ['Card', <Card key="c" />],
  ['Chip off', <Chip key="ch" label="All" count={12} onPress={noop} />],
  ['Chip on', <Chip key="ch2" label="Active" selected onPress={noop} />],
  ['Pill red', <Pill key="p1" label="2 days" tone="red" />],
  ['Pill amber', <Pill key="p2" label="5 days" tone="amber" />],
  ['Pill gray', <Pill key="p3" label="21 days" tone="gray" />],
  ['Pill green', <Pill key="p4" label="Returned" tone="green" />],
  ['Pill teal', <Pill key="p5" label="Kept" tone="teal" />],
  [
    'ListRow',
    <ListRow key="l" title="Target" subtitle="$48.20" right={<Pill label="2 days" tone="red" />} />,
  ],
  ['Banner warn', <Banner key="bw" kind="warn" message="Window closes soon" />],
  ['Banner info', <Banner key="bi" kind="info" message="Synced" />],
  ['Banner offline', <Banner key="bo" kind="offline" message="You are offline" />],
  [
    'Sheet',
    <Sheet key="s" visible onClose={noop} title="Export">
      <AppText>Body</AppText>
    </Sheet>,
  ],
  [
    'EmptyState',
    <EmptyState
      key="e"
      icon="receipt"
      title="No receipts"
      message="Scan one"
      actionLabel="Scan"
      onAction={noop}
    />,
  ],
  ['CountdownRing', <CountdownRing key="r" daysLeft={5} totalDays={30} />],
  ['ProLock', <ProLock key="pl" />],
  ['Skeleton', <Skeleton key="sk" />],
  ['ScreenHeader large', <ScreenHeader key="h1" title="Receipts" />],
  ['ScreenHeader nav', <ScreenHeader key="h2" mode="nav" title="Receipt" onBack={noop} />],
  ['Icon', <Icon key="i" name="home" />],
];

describe.each<ColorScheme>(['light', 'dark'])('components render in %s theme', (scheme) => {
  it.each(cases)('%s', async (_name, ui) => {
    const { toJSON } = await renderWithTheme(ui, scheme);
    expect(toJSON()).toBeTruthy();
  });
});

describe('component behaviour', () => {
  it('Pill tone follows days left: red 0–2, amber 3–7, gray 8+', () => {
    expect([0, 2, 3, 7, 8, 30].map(toneForDaysLeft)).toEqual([
      'red',
      'red',
      'amber',
      'amber',
      'gray',
      'gray',
    ]);
  });

  it('TextField secure toggle shows and hides the password', async () => {
    await renderWithTheme(<TextField label="Password" secure testID="pw" />);
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(true);
    await fireEvent.press(screen.getByLabelText('Show password'));
    expect(screen.getByTestId('pw').props.secureTextEntry).toBe(false);
  });

  it('Chip exposes selected state and count', async () => {
    await renderWithTheme(<Chip label="Active" count={3} selected onPress={noop} testID="chip" />);
    expect(screen.getByTestId('chip')).toBeSelected();
    expect(screen.getByLabelText('Active, 3')).toBeTruthy();
  });

  it('CountdownRing clamps and labels days left', async () => {
    await renderWithTheme(<CountdownRing daysLeft={1} totalDays={30} testID="ring" />);
    expect(screen.getByLabelText('1 day left')).toBeTruthy();
  });
});
