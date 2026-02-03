import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfig } from "../context/ConfigContext";

export default function Home() {
  const { t } = useTranslation();
  const { botDisplayName } = useConfig();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="mb-8">
        <div className="w-20 h-20 rounded-2xl border-2 border-dark-600 bg-gradient-to-br from-dark-800 to-dark-900 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-dark-950/50">
          <span className="text-5xl leading-none">🤓</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">{t("home.welcome", { name: botDisplayName })}</h1>
        <p className="text-dark-400 text-lg max-w-md mx-auto">
          {t("home.description")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/jobs"
          className="group glass-card px-6 py-4 hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">{t("home.viewJobs")}</p>
              <p className="text-dark-400 text-sm">{t("home.viewJobsDescription")}</p>
            </div>
          </div>
        </Link>

        <Link
          to="/settings"
          className="group glass-card px-6 py-4 hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-colors">
              <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">{t("home.settings")}</p>
              <p className="text-dark-400 text-sm">{t("home.settingsDescription")}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
