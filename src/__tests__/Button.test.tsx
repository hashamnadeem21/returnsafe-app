import { fireEvent, screen } from '@testing-library/react-native';

import { Button, type ButtonVariant } from '@/components';

import { renderWithTheme } from '@/test/render';

describe('TC-103 Button', () => {
  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" onPress={onPress} testID="btn" />);
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" onPress={onPress} disabled testID="btn" />);
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn')).toBeDisabled();
  });

  it('does not call onPress while loading and shows a spinner', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button label="Save" onPress={onPress} loading testID="btn" />);
    await fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn-spinner')).toBeTruthy();
    expect(screen.getByTestId('btn')).toBeBusy();
  });

  const variants: ButtonVariant[] = ['primary', 'secondary', 'soft', 'danger', 'text'];
  it.each(variants)('matches snapshot: %s', async (variant) => {
    const { toJSON } = await renderWithTheme(
      <Button label="Label" variant={variant} onPress={() => {}} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot: disabled', async () => {
    const { toJSON } = await renderWithTheme(<Button label="Label" disabled onPress={() => {}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot: loading', async () => {
    const { toJSON } = await renderWithTheme(<Button label="Label" loading onPress={() => {}} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
