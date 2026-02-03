import { useRef, useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Job from "./pages/Job";
import Settings from "./pages/Settings";

function NavTabs({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = ref.current;
    if (!nav) return;

    const tabs = nav.querySelectorAll<HTMLElement>(".nav-item");
    tabs.forEach((tab, i) => {
      nav.style.setProperty(`--tab-${i}-width`, `${tab.offsetWidth}px`);
    });
  }, []);

  return (
    <nav ref={ref} className="nav-tabs relative flex items-center gap-1">
      <div className="nav-highlight" />
      {children}
    </nav>
  );
}

function NavItem({
  to,
  icon,
  children,
  index,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <NavLink
      to={to}
      data-index={index}
      className={({ isActive }) =>
        `nav-item group relative z-10 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
          isActive ? "active text-white" : "text-dark-400 hover:text-white hover:bg-dark-800/80"
        }`
      }
    >
      <span className="transition-transform duration-200 group-hover:scale-110">{icon}</span>
      {children}
    </NavLink>
  );
}

export default function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900/60 backdrop-blur-xl border-b border-dark-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg border border-dark-600 bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center">
                  <span className="text-xl leading-none">🤓</span>
                </div>
                <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">{t("common.admin")}</span>
              </div>
              <NavTabs>
                <NavItem
                  to="/"
                  index={0}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  }
                >
                  {t("nav.home")}
                </NavItem>
                <NavItem
                  to="/jobs"
                  index={1}
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                >
                  {t("nav.jobs")}
                </NavItem>
              </NavTabs>
            </div>
            <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `group p-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-accent to-purple-600 text-white shadow-lg shadow-accent/30"
                      : "text-dark-400 hover:text-white hover:bg-dark-800/80"
                  }`
                }
                title={t("nav.settings")}
              >
                <svg className="w-5 h-5 transition-transform duration-200 group-hover:rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            </NavLink>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<Job />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
