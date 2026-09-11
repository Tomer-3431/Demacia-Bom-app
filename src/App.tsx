import { HashRouter, Routes, Route } from 'react-router-dom';
import './css/App.css';
import MainLayout from './components/MainLayout';
import HomeScreen from './home/HomePage';
import BomDetailsPage from './Bom/BomDetailsPage';
import WorkOrderDetailsPage from './WorkOrder/WorkOrderDetailsPage';
import PartsSearchPage from './searchParts/SearchParts';
import AssemblyBomPage from './assembly-extension/AssemblyBomPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/home" element={<HomeScreen />} />
          <Route path="/onshape" element={<AssemblyBomPage />} />
          <Route path="/bom/:bomId" element={<BomDetailsPage />} />
          <Route path="/workOrder/:workOrderID" element={<WorkOrderDetailsPage />} />
          <Route path="/partSearch" element={<PartsSearchPage />} />

          <Route path="*" element={<HomeScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
