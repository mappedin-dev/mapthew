import { useAuth0 } from "@auth0/auth0-react";
import { useTranslation } from "react-i18next";

export function AccessDenied() {
  const { t } = useTranslation();
  const { logout, user } = useAuth0();

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin + "/admin" } });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl border-2 border-red-500/30 bg-gradient-to-br from-red-900/20 to-red-950/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-950/20">
          <svg
            className="w-10 h-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{t("auth.denied.title")}</h1>
        <p className="text-dark-400 mb-2">{t("auth.denied.description")}</p>
        {user?.email && (
          <p className="text-dark-500 text-sm mb-8">
            {t("auth.denied.signedInAs", { email: user.email })}
          </p>
        )}

        <button
          onClick={handleLogout}
          className="px-6 py-2.5 bg-dark-800 hover:bg-dark-700 text-white font-medium rounded-lg transition-colors duration-200 border border-dark-600"
        >
          {t("auth.denied.logout")}
        </button>
      </div>
    </div>
  );
}
