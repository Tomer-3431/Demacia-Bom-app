import { HashRouter, Routes, Route } from 'react-router-dom';
import './css/App.css';
import MainLayout from './components/MainLayout';
import { OnshapePage } from './pages/OnshapePage';
import CreateBomPage from './pages/CreateBomPage';
import CreatePartPage from './pages/CreatePartPage';
import HomeScreen from './home/HomePage';
import BomDetailsPage from './Bom/BomDetailsPage';
import WorkOrderDetailsPage from './WorkOrder/WorkOrderDetailsPage';
import PartsSearchPage from './searchParts/SearchParts';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/onshape" element={<OnshapePage />} />
          <Route path="/new-bom" element={<CreateBomPage />} />
          <Route path="/new-part" element={<CreatePartPage />} />
          <Route path="/bom/:bomId" element={<BomDetailsPage />} />
          <Route path="/workOrder/:workOrderID" element={<WorkOrderDetailsPage />} />
          <Route path="/partSearch" element={<PartsSearchPage />} />

          <Route path="*" element={<HomeScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
