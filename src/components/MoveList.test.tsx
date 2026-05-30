import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoveList } from './MoveList';

describe('MoveList', () => {
  it('shows all moves by default', () => {
    render(<MoveList moves={['R', 'U', 'F2']} currentIndex={1} onJump={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'R' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'U' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'F2' })).toBeInTheDocument();
  });

  it('masks the current and future moves until the current answer is revealed', () => {
    render(
      <MoveList
        moves={['R', 'U', 'F2']}
        currentIndex={1}
        onJump={vi.fn()}
        maskFromIndex={1}
        revealCurrent={false}
      />,
    );

    expect(screen.getByRole('button', { name: 'R' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'U' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'F2' })).not.toBeInTheDocument();
    expect(screen.getAllByText('???')).toHaveLength(2);
  });

  it('reveals the current move while keeping future moves hidden', () => {
    render(
      <MoveList
        moves={['R', 'U', 'F2']}
        currentIndex={1}
        onJump={vi.fn()}
        maskFromIndex={1}
        revealCurrent={true}
      />,
    );

    expect(screen.getByRole('button', { name: 'R' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'U' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'F2' })).not.toBeInTheDocument();
    expect(screen.getByText('???')).toBeInTheDocument();
  });

  it('still lets users jump to a masked move by index', () => {
    const onJump = vi.fn();
    render(
      <MoveList
        moves={['R', 'U', 'F2']}
        currentIndex={1}
        onJump={onJump}
        maskFromIndex={1}
        revealCurrent={false}
      />,
    );

    fireEvent.click(screen.getAllByText('???')[1]);
    expect(onJump).toHaveBeenCalledWith(2);
  });
});
