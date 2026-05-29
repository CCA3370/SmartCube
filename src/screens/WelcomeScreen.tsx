import { useApp } from '../app/AppContext';

export function WelcomeScreen() {
  const { dispatch, state } = useApp();
  return (
    <div className="center-col fade-in">
      <div style={{ fontSize: '3.5rem' }}>🧩</div>
      <div>
        <h1 className="title">SmartCube</h1>
        <p className="subtitle" style={{ maxWidth: 420 }}>
          Scan your scrambled 3×3 cube with the camera, then follow the 3D animation
          step by step to solve it in the fewest moves.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 440, textAlign: 'left' }}>
        <strong>How it works</strong>
        <ol style={{ margin: '10px 0 0', paddingLeft: 20, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          <li>Keep the cube scrambled. Hold each face up to the camera — we use the fixed center piece to know which face it is, and capture when it's sharp and steady.</li>
          <li>Check the recognized colors and fix any that are off.</li>
          <li>Get the optimal solution and follow the animated moves.</li>
        </ol>
      </div>

      <button className="btn btn-primary" onClick={() => dispatch({ type: 'START' })}>
        Start camera & scan
      </button>
      <p className="subtitle" style={{ fontSize: '0.8rem' }}>
        {state.solverReady ? 'Solver ready.' : 'Preparing the solver…'} Camera access is required.
      </p>
    </div>
  );
}
