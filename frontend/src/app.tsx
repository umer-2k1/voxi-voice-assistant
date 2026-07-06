import { BrowserRouter, Route, Routes } from 'react-router-dom';

import RootProvider from './components/providers/root';
import MainWindow from './windows/main';
import OverlayWindow from './windows/overlay';

function App() {
  return (
    <RootProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<MainWindow />} />
          <Route path='/overlay' element={<OverlayWindow />} />
        </Routes>
      </BrowserRouter>
    </RootProvider>
  );
}

export default App;
