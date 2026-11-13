import { palettes, radii, spacing, type } from '@/theme';

describe('design tokens', () => {
  it('light and dark palettes define the same keys', () => {
    expect(Object.keys(palettes.dark).sort()).toEqual(Object.keys(palettes.light).sort());
  });

  it('uses the brand teal as light primary', () => {
    expect(palettes.light.primary).toBe(palettes.light.brand);
  });

  it('matches the spec type scale', () => {
    expect([type.display.fontSize, type.display.lineHeight]).toEqual([28, 34]);
    expect([type.title.fontSize, type.title.lineHeight]).toEqual([22, 28]);
    expect([type.headline.fontSize, type.headline.lineHeight]).toEqual([17, 22]);
    expect([type.body.fontSize, type.body.lineHeight]).toEqual([16, 22]);
    expect([type.caption.fontSize, type.caption.lineHeight]).toEqual([13, 18]);
    expect([type.label.fontSize, type.label.lineHeight]).toEqual([12, 16]);
  });

  it('matches the spec radii and spacing grid', () => {
    expect(radii).toMatchObject({ card: 16, button: 14, input: 12 });
    expect(spacing.screen).toBe(20);
    Object.values(spacing).forEach((v) => expect(v % 2).toBe(0));
  });
});
