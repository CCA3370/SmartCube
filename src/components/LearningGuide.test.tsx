import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LearningGuide } from './LearningGuide';

describe('LearningGuide', () => {
  it('starts as a self-check prompt with the move answer hidden', () => {
    render(
      <LearningGuide
        move="R"
        index={0}
        total={3}
        revealed={false}
        masteredFamilies={new Set()}
        onReveal={vi.fn()}
        onMastered={vi.fn()}
      />,
    );

    expect(screen.getByText('Learn mode')).toBeInTheDocument();
    expect(screen.getByText('Step 1 / 3')).toBeInTheDocument();
    expect(screen.getByText('Hide the answer first. Decide which face turns and in which direction.')).toBeInTheDocument();
    expect(screen.queryByText('R: Right face clockwise')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('shows bilingual instructions after reveal and can mark the move family mastered', () => {
    const onMastered = vi.fn();
    render(
      <LearningGuide
        move="R"
        index={0}
        total={3}
        revealed={true}
        masteredFamilies={new Set()}
        onReveal={vi.fn()}
        onMastered={onMastered}
      />,
    );

    expect(screen.getByText('R: Right face clockwise')).toBeInTheDocument();
    expect(screen.getByText('R：右面顺时针')).toBeInTheDocument();
    expect(screen.getByText(/Turn the right face clockwise/)).toBeInTheDocument();
    expect(screen.getByText(/把右面顺时针/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /i know this/i }));
    expect(onMastered).toHaveBeenCalledWith('R');
  });

  it('shows mastered progress and disables the mastered button for known families', () => {
    render(
      <LearningGuide
        move="R2"
        index={1}
        total={3}
        revealed={true}
        masteredFamilies={new Set(['R'])}
        onReveal={vi.fn()}
        onMastered={vi.fn()}
      />,
    );

    expect(screen.getByText('Known move families: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /known/i })).toBeDisabled();
  });

  it('shows a completion review after the final move', () => {
    render(
      <LearningGuide
        move={null}
        index={3}
        total={3}
        revealed={true}
        masteredFamilies={new Set(['R', 'U'])}
        onReveal={vi.fn()}
        onMastered={vi.fn()}
      />,
    );

    expect(screen.getByText('Review complete')).toBeInTheDocument();
    expect(screen.getByText(/You practiced 3 moves/)).toBeInTheDocument();
    expect(screen.getByText(/你已经完成 3 步练习/)).toBeInTheDocument();
  });
});
