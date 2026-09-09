import { HashRouter, Routes, Route } from 'react-router-dom';
import './css/App.css';
import Home from './pages/HomePage';
import MainLayout from './components/MainLayout';
import { OnshapePage } from './pages/OnshapePage';
import BomDetailsPage from './pages/BomdetailsPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/onshape" element={<OnshapePage />} />
          <Route path="/bom/:bomId" element={<BomDetailsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
