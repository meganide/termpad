import { useEffect, useRef, type KeyboardEvent } from 'react';

const CARD_SELECTOR = 'button[data-overview-terminal-id]';

function focusCard(card: HTMLButtonElement) {
  card.focus({ preventScroll: true });
  card.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** Navigate the rendered rows, including partial rows and repository boundaries. */
export function useOverviewNavigation(enabled: boolean, activeTerminalId: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const cards = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>(CARD_SELECTOR) ?? []
    );
    const initial =
      cards.find((card) => card.dataset.overviewTerminalId === activeTerminalId) ?? cards[0];
    if (initial) focusCard(initial);
  }, [enabled, activeTerminalId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!enabled || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const cards = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(CARD_SELECTOR)
    );
    const index = cards.indexOf(event.target as HTMLButtonElement);
    if (index === -1) return;

    event.preventDefault();
    event.stopPropagation();
    let next: HTMLButtonElement | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      next = cards[index + (event.key === 'ArrowLeft' ? -1 : 1)];
    } else {
      const current = cards[index].getBoundingClientRect();
      const direction = event.key === 'ArrowUp' ? -1 : 1;
      // Read geometry at keypress time so resizing never leaves a stale column count.
      const candidates = cards
        .map((card) => ({ card, rect: card.getBoundingClientRect() }))
        .filter(({ rect }) => (rect.top - current.top) * direction > 1)
        .sort((a, b) => {
          const rowDistance =
            Math.abs(a.rect.top - current.top) - Math.abs(b.rect.top - current.top);
          if (Math.abs(rowDistance) > 1) return rowDistance;
          const center = current.left + current.width / 2;
          return (
            Math.abs(a.rect.left + a.rect.width / 2 - center) -
            Math.abs(b.rect.left + b.rect.width / 2 - center)
          );
        });
      next = candidates[0]?.card;
    }
    if (next) focusCard(next);
  };

  return { containerRef, onKeyDown };
}
