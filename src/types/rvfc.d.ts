// requestVideoFrameCallback is widely shipped (Chrome/Safari/Firefox) but not
// always present in the TS lib. Declare the minimal surface we use.
interface HTMLVideoElement {
  requestVideoFrameCallback?(callback: (now: number, metadata: unknown) => void): number;
  cancelVideoFrameCallback?(handle: number): void;
}
