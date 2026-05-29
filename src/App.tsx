import { AppProvider, useApp } from './app/AppContext';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ScanScreen } from './screens/ScanScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SolveScreen } from './screens/SolveScreen';
import { DoneScreen } from './screens/DoneScreen';

function Router() {
  const { state } = useApp();
  switch (state.screen) {
    case 'welcome':
      return <WelcomeScreen />;
    case 'scan':
      return <ScanScreen />;
    case 'review':
      return <ReviewScreen />;
    case 'solve':
      return <SolveScreen />;
    case 'done':
      return <DoneScreen />;
  }
}

export function App() {
  return (
    <AppProvider>
      <div className="app-shell">
        <Router />
      </div>
    </AppProvider>
  );
}
