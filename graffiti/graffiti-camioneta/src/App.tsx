// src/App.jsx

import GraffitiCanvas from './components/GraffitiCanvas';

function App() {
  return (
    <div style={{
      backgroundColor: '#000000',
      minHeight: '100vh',
      color: '#00ff00',
      fontFamily: "'Courier New', monospace",
      padding: 0,
      margin: 0
    }}>
      <GraffitiCanvas />
    </div>
  );
}

export default App;