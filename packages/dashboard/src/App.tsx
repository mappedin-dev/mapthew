import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Job from "./pages/Job";
import NewJob from "./pages/NewJob";
import Sessions from "./pages/Sessions";
import Settings from "./pages/Settings";
import { Header } from "./components/Header";

function AppContent() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<Jobs />} />
          <Route path="/tasks/:id" element={<Job />} />
          <Route path="/new-task" element={<NewJob />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
