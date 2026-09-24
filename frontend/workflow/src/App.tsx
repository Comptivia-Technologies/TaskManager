import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LazyMotion } from 'framer-motion';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import { PERMISSIONS, hasPermission } from './utils/roleUtils';
import { Login } from './pages/Login';
import AppLayout from './components/AppLayout';
import Workflows from './pages/Workflows';
import WorkflowDetail from './pages/WorkflowDetail';
import Teams from './pages/Teams';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import SLAConfiguration from './pages/SLAConfiguration';
import WorkloadConfiguration from './pages/WorkloadConfiguration';
import TaskDetail from './pages/TaskDetail';
import MyEnquiries from './pages/MyEnquiries';
import PriorityRules from './pages/PriorityRules';
import Users from './pages/Users';
import RolesPermissions from './pages/RolesPermissions';

// Loaded as its own chunk after first paint; the first frame needs no animation.
const loadMotionFeatures = () => import('./utils/motionFeatures').then((mod) => mod.default);

const HomeRedirect = () => {
  const { permissions, sessionLoading } = useAuth();
  if (sessionLoading) return <LoadingSpinner />;
  return <Navigate to={hasPermission(permissions, PERMISSIONS.workflowsView) ? '/workflows' : '/enquiry'} replace />;
};

function App() {
  return (
    <AuthProvider>
      {/* The DOM feature set loads as its own chunk after first paint. `strict` keeps
          us on the lightweight `m` components — a stray `motion` import would quietly
          pull the whole library back into the main bundle. */}
      <LazyMotion features={loadMotionFeatures} strict>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout><HomeRedirect /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/enquiry"
            element={
              <ProtectedRoute>
                <AppLayout><MyEnquiries /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute requires={PERMISSIONS.workflowsView}>
                <AppLayout><Workflows /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows/:id"
            element={
              <ProtectedRoute requires={PERMISSIONS.workflowsView}>
                <AppLayout><WorkflowDetail /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/teams"
            element={
              <ProtectedRoute requires={PERMISSIONS.teamsView}>
                <AppLayout><Teams /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute requires={PERMISSIONS.membersView}>
                <AppLayout><Members /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/members/:id"
            element={
              <ProtectedRoute requires={PERMISSIONS.membersView}>
                <AppLayout><MemberDetail /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <AppLayout><TaskDetail /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sla-configuration"
            element={
              <ProtectedRoute requires={PERMISSIONS.slaView}>
                <AppLayout><SLAConfiguration /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workload-configuration"
            element={
              <ProtectedRoute requires={PERMISSIONS.workloadView}>
                <AppLayout><WorkloadConfiguration /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/priority-rules"
            element={
              <ProtectedRoute requires={PERMISSIONS.priorityRulesView}>
                <AppLayout><PriorityRules /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requires={PERMISSIONS.usersView}>
                <AppLayout><Users /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles-permissions"
            element={
              <ProtectedRoute requires={PERMISSIONS.rolesView}>
                <AppLayout><RolesPermissions /></AppLayout>
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
      </LazyMotion>
    </AuthProvider>
  );
}

export default App;



