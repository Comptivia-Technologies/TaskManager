import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import Sidebar from './components/Sidebar';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Teams from './pages/Teams';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import SLAConfiguration from './pages/SLAConfiguration';
import WorkloadConfiguration from './pages/WorkloadConfiguration';
import Tasks from './pages/Tasks';
import PriorityRules from './pages/PriorityRules';
import Users from './pages/Users';
import RolesPermissions from './pages/RolesPermissions';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <Navigate to="/workflows" replace />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <Workflows />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows/:id"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <WorkflowDetail />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <Teams />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <Members />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members/:id"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <MemberDetail />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <Tasks />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sla-configuration"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <SLAConfiguration />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workload-configuration"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <WorkloadConfiguration />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/priority-rules"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <PriorityRules />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <Users />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles-permissions"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <RolesPermissions />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
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
      </Router>
    </AuthProvider>
  );
}

export default App;



