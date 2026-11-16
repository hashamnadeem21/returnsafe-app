import { centsToInput, formatUsd, isValidAmount, MAX_CENTS, parseUsd } from '@/lib/money';

describe('money', () => {
  it.each([
    ['48.20', 4820],
    ['48.2', 4820],
    ['48', 4800],
    ['$48.20', 4820],
    ['  1,299.99 ', 129999],
    ['.5', 50],
    ['0.01', 1],
    ['99999.99', MAX_CENTS],
  ])('parses %s as %i cents', (text, cents) => {
    expect(parseUsd(text)).toBe(cents);
  });

  it.each(['', '.', 'abc', '1.234', '-5', '1,23', '12a'])('rejects "%s"', (text) => {
    expect(parseUsd(text)).toBeNull();
  });

  it('formats cents as US dollars', () => {
    expect(formatUsd(4820)).toBe('$48.20');
    expect(formatUsd(129999)).toBe('$1,299.99');
    expect(formatUsd(MAX_CENTS)).toBe('$99,999.99');
    expect(formatUsd(0)).toBe('$0.00');
    expect(centsToInput(4805)).toBe('48.05');
  });

  it('allows 0.01 to 99,999.99 only', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(MAX_CENTS)).toBe(true);
    expect(isValidAmount(MAX_CENTS + 1)).toBe(false);
    expect(isValidAmount(null)).toBe(false);
  });
});
