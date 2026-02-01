import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Teams from './pages/Teams';
import Members from './pages/Members';
import SLAConfiguration from './pages/SLAConfiguration';
import WorkloadConfiguration from './pages/WorkloadConfiguration';
import Tasks from './pages/Tasks';
import PriorityRules from './pages/PriorityRules';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-white font-sans">
        <Sidebar />
        <div className="flex-1 ml-64 font-sans bg-white">
          <Routes>
            <Route path="/" element={<Navigate to="/workflows" replace />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/:id" element={<WorkflowDetail />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/members" element={<Members />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/sla-configuration" element={<SLAConfiguration />} />
            <Route path="/workload-configuration" element={<WorkloadConfiguration />} />
            <Route path="/priority-rules" element={<PriorityRules />} />
          </Routes>
        </div>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          toastClassName="shadow-azure-lg rounded-azure-sm"
          progressClassName="bg-azure-600"
        />
      </div>
    </Router>
  );
}

export default App;



