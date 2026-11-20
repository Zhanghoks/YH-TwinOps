import type { ButtonHTMLAttributes } from 'react';

/** Adapted from Beautiful UI's atoms/Button.tsx (MIT); see adjacent LICENSE.
 * Replaces Tailwind utility assembly with scoped CSS in the existing Vite app. */
export type BeautifulButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'success' | 'quiet';
export type BeautifulButtonSize = 'xs' | 'sm' | 'md';
export function BeautifulButton({
  variant = 'secondary', size = 'md', className, type = 'button', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BeautifulButtonVariant; size?: BeautifulButtonSize }) {
  return <button type={type} className={['bu-button', className].filter(Boolean).join(' ')} data-variant={variant} data-size={size} {...props} />;
}
