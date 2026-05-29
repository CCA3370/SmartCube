// Augment the standard MediaStreamTrack types with the non-standard but widely
// implemented "image capture" advanced constraints (Chromium on Android). These
// are NOT in lib.dom, and we only ever use them behind getCapabilities() checks.

interface MediaTrackCapabilities {
  torch?: boolean;
  focusMode?: string[];
  exposureMode?: string[];
  whiteBalanceMode?: string[];
  zoom?: { min: number; max: number; step: number };
}

interface MediaTrackConstraintSet {
  torch?: boolean;
  focusMode?: ConstrainDOMString;
  exposureMode?: ConstrainDOMString;
  whiteBalanceMode?: ConstrainDOMString;
  zoom?: ConstrainDouble;
}

interface MediaTrackSettings {
  torch?: boolean;
  focusMode?: string;
  exposureMode?: string;
  whiteBalanceMode?: string;
  zoom?: number;
}
