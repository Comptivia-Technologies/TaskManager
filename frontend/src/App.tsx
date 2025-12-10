import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Teams from './pages/Teams';
import Members from './pages/Members';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-white font-sans">
        <Sidebar />
        <div className="flex-1 ml-64 font-sans bg-white">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/:id" element={<WorkflowDetail />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/members" element={<Members />} />
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



