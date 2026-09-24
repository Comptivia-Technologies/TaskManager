import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import { PERMISSIONS, hasPermission } from './utils/roleUtils';
import { Login } from './pages/Login';
import Sidebar from './components/Sidebar';
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

const HomeRedirect = () => {
  const { permissions, sessionLoading } = useAuth();
  if (sessionLoading) return <LoadingSpinner />;
  return <Navigate to={hasPermission(permissions, PERMISSIONS.workflowsView) ? '/workflows' : '/enquiry'} replace />;
};

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
                    <HomeRedirect />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/enquiry"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <MyEnquiries />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflows"
            element={
              <ProtectedRoute requires={PERMISSIONS.workflowsView}>
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
              <ProtectedRoute requires={PERMISSIONS.workflowsView}>
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
              <ProtectedRoute requires={PERMISSIONS.teamsView}>
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
              <ProtectedRoute requires={PERMISSIONS.membersView}>
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
              <ProtectedRoute requires={PERMISSIONS.membersView}>
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
            path="/tasks/:id"
            element={
              <ProtectedRoute>
                <div className="flex min-h-screen bg-white font-sans">
                  <Sidebar />
                  <div className="flex-1 ml-64 font-sans bg-white">
                    <TaskDetail />
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sla-configuration"
            element={
              <ProtectedRoute requires={PERMISSIONS.slaView}>
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
              <ProtectedRoute requires={PERMISSIONS.workloadView}>
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
              <ProtectedRoute requires={PERMISSIONS.priorityRulesView}>
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
              <ProtectedRoute requires={PERMISSIONS.usersView}>
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
              <ProtectedRoute requires={PERMISSIONS.rolesView}>
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



