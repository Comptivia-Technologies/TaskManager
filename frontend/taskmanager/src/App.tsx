import { Routes, Route } from 'react-router-dom';
import TaskManagerList from './TaskManagerList';
import TaskManagerDetail from './TaskManagerDetail';
import Sidebar from './Sidebar';

const App = () => {
  return (
    <div className="tm-layout">
      <Sidebar />
      <main className="tm-main">
        <Routes>
          <Route path="/" element={<TaskManagerList />} />
          <Route path="/tasks/:id" element={<TaskManagerDetail />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;


