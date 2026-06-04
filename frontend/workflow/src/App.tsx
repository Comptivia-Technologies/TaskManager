import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import { Login } from './pages/Login';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Teams from './pages/Teams';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import SLAConfiguration from './pages/SLAConfiguration';
import WorkloadConfiguration from './pages/WorkloadConfiguration';
import Tasks from './pages/Tasks';
import PriorityRules from './pages/PriorityRules';
import AppUsers from './pages/AppUsers';
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
                <AppShell>
                  <Navigate to="/workflows" replace />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Workflows />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WorkflowDetail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Teams />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Members />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <MemberDetail />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Tasks />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sla-configuration"
            element={
              <ProtectedRoute>
                <AppShell>
                  <SLAConfiguration />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workload-configuration"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WorkloadConfiguration />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/priority-rules"
            element={
              <ProtectedRoute>
                <AppShell>
                  <PriorityRules />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AppUsers />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles-permissions"
            element={
              <ProtectedRoute>
                <AppShell>
                  <RolesPermissions />
                </AppShell>
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
