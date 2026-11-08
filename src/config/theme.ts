import { brand } from './brand';

const colorTokens = ['primary', 'primaryForeground', 'background', 'foreground', 'card', 'muted', 'border', 'destructive'] as const;

export function applyTheme(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  for (const token of colorTokens) {
    const darkToken = `dark${token[0].toUpperCase()}${token.slice(1)}` as keyof typeof brand.theme;
    const cssName = `--${token.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
    root.style.setProperty(cssName, dark ? brand.theme[darkToken] : brand.theme[token]);
  }
}
