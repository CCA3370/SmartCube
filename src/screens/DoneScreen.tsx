import { useApp } from '../app/AppContext';

export function DoneScreen() {
  const { dispatch } = useApp();
  return (
    <div className="center-col fade-in">
      <div style={{ fontSize: '4rem' }}>🎉</div>
      <div>
        <h1 className="title">Solved!</h1>
        <p className="subtitle" style={{ maxWidth: 380 }}>
          Nice work. Scramble it again whenever you want another solve.
        </p>
      </div>
      <button className="btn btn-primary" onClick={() => dispatch({ type: 'RESTART' })}>
        Scan another cube
      </button>
    </div>
  );
}
