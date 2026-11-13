import { render, screen } from '@testing-library/react-native';

import PlaceholderScreen from '@/app/index';

describe('PlaceholderScreen', () => {
  it('renders the app name and phase', async () => {
    await render(<PlaceholderScreen />);
    expect(screen.getByText('ReturnSafe')).toBeOnTheScreen();
    expect(screen.getByText('Phase 0 — Foundation')).toBeOnTheScreen();
  });
});
