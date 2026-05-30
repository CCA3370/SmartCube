import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FaceGrid } from './FaceGrid';
import type { FaceLetter } from '../lib/cube';

const solved = (f: FaceLetter): FaceLetter[] => Array(9).fill(f);

describe('FaceGrid', () => {
  it('shows the face letter on every sticker as a non-color cue', () => {
    render(<FaceGrid labels={solved('U')} />);
    expect(screen.getAllByText('U')).toHaveLength(9);
  });

  it('opens a color picker and edits a non-center sticker', () => {
    const onEdit = vi.fn();
    render(<FaceGrid labels={solved('U')} editable onEdit={onEdit} />);

    // No picker until a sticker is tapped.
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Sticker 1: White/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Red' }));
    expect(onEdit).toHaveBeenCalledWith(0, 'R');
    // Picker closes after a choice.
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('locks the center sticker (no picker, no edit)', () => {
    const onEdit = vi.fn();
    render(<FaceGrid labels={solved('U')} editable onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /Sticker 5: White/i }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('is read-only when not editable (no picker opens)', () => {
    render(<FaceGrid labels={solved('F')} />);
    fireEvent.click(screen.getByRole('button', { name: /Sticker 1: Green/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
