import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOverviewNavigation } from './useOverviewNavigation';

function Overview() {
  const { containerRef, onKeyDown } = useOverviewNavigation(true, '2');
  return (
    <div ref={containerRef} onKeyDown={onKeyDown}>
      {[0, 1, 2, 3, 4, 5, 6].map((id) => (
        <button key={id} data-overview-terminal-id={id}>
          Agent {id}
        </button>
      ))}
    </div>
  );
}

function setPositions(positions: [number, number][]) {
  const cards = screen.getAllByRole('button');
  cards.forEach((card, index) => {
    const [left, top] = positions[index];
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left,
      top,
      width: 360,
      height: 384,
      right: left + 360,
      bottom: top + 384,
      x: left,
      y: top,
      toJSON: () => ({}),
    });
  });
  return cards;
}

describe('overview keyboard navigation', () => {
  it('moves vertically across partial rows and repository headings', () => {
    render(<Overview />);
    const cards = setPositions([
      [0, 40],
      [376, 40],
      [752, 40],
      [1128, 40],
      [0, 440],
      [376, 440], // partial second row
      [0, 900], // next repository, below its heading
    ]);
    expect(cards[2]).toHaveFocus();
    fireEvent.keyDown(cards[2], { key: 'ArrowDown' });
    expect(cards[5]).toHaveFocus();
    fireEvent.keyDown(cards[5], { key: 'ArrowDown' });
    expect(cards[6]).toHaveFocus();
    fireEvent.keyDown(cards[6], { key: 'ArrowUp' });
    expect(cards[4]).toHaveFocus();
  });

  it('uses the new rows after a responsive resize', () => {
    render(<Overview />);
    const cards = setPositions([
      [0, 40],
      [376, 40],
      [752, 40],
      [1128, 40],
      [0, 440],
      [376, 440],
      [752, 440],
    ]);
    fireEvent.keyDown(cards[2], { key: 'ArrowDown' });
    expect(cards[6]).toHaveFocus();
    setPositions([
      [0, 40],
      [376, 40],
      [0, 440],
      [376, 440],
      [0, 840],
      [376, 840],
      [0, 1240],
    ]);
    fireEvent.keyDown(cards[6], { key: 'ArrowUp' });
    expect(cards[4]).toHaveFocus();
  });

  it('stays at the outer edges and leaves modified arrow shortcuts alone', () => {
    render(<Overview />);
    const cards = screen.getAllByRole('button');
    cards[0].focus();
    fireEvent.keyDown(cards[0], { key: 'ArrowLeft' });
    expect(cards[0]).toHaveFocus();
    fireEvent.keyDown(cards[0], { key: 'ArrowRight', ctrlKey: true });
    expect(cards[0]).toHaveFocus();
    cards[6].focus();
    fireEvent.keyDown(cards[6], { key: 'ArrowRight' });
    expect(cards[6]).toHaveFocus();
  });
});
