import { describe, expect, it, vi } from 'vitest';
import { makeStepper, type StepperState } from './stepping';

class FakeFreshProp<T> {
  private listeners = new Set<(value: T) => void>();

  constructor(private value: T) {}

  addFreshListener(listener: (value: T) => void): void {
    this.listeners.add(listener);
    listener(this.value);
  }

  removeFreshListener(listener: (value: T) => void): void {
    this.listeners.delete(listener);
  }

  emit(value: T): void {
    this.value = value;
    this.listeners.forEach((listener) => listener(value));
  }
}

describe('makeStepper', () => {
  it('publishes index, playing, and completion updates from TwistyPlayer props', () => {
    const currentLeavesSimplified = new FakeFreshProp({ patternIndex: 0 });
    const detailedTimelineInfo = new FakeFreshProp({ atStart: true, atEnd: false });
    const playingInfo = new FakeFreshProp({ playing: false });
    const player = {
      experimentalModel: { currentLeavesSimplified, detailedTimelineInfo, playingInfo },
      controller: { animationController: { play: vi.fn(), pause: vi.fn() } },
      play: vi.fn(),
      pause: vi.fn(),
      jumpToStart: vi.fn(),
      jumpToEnd: vi.fn(),
    } as unknown as Parameters<typeof makeStepper>[0];
    const stepper = makeStepper(player, 3);
    const states: StepperState[] = [];

    stepper.subscribe((state) => states.push({ ...state }));
    playingInfo.emit({ playing: true });
    currentLeavesSimplified.emit({ patternIndex: 2 });
    detailedTimelineInfo.emit({ atStart: false, atEnd: true });

    expect(states).toEqual([
      { index: 0, playing: false, atEnd: false },
      { index: 0, playing: true, atEnd: false },
      { index: 2, playing: true, atEnd: false },
      { index: 3, playing: false, atEnd: true },
    ]);

    stepper.dispose();
    currentLeavesSimplified.emit({ patternIndex: 1 });
    expect(states).toHaveLength(4);
  });
});
