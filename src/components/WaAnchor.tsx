import type { MouseEvent, ReactNode } from 'react';

/**
 * WhatsApp call-to-action rendered as a button so crawlers do not count
 * wa.me as an outbound link (wa.me rate-limits bots with HTTP 429, which
 * audit tools report as broken external links). Opens the same chat.
 */
export function WaAnchor({ href, className, children, onClick, 'aria-label': ariaLabel }: {
  href: string;
  className?: string;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        onClick?.(e);
        window.open(href, '_blank', 'noopener,noreferrer');
      }}
    >
      {children}
    </button>
  );
}
