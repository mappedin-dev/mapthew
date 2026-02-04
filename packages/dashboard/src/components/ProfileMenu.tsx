import { useTranslation } from "react-i18next";
import { useAuth0 } from "@auth0/auth0-react";
import { Menu } from "./Menu";

export function ProfileMenu() {
  const { t } = useTranslation();
  const { logout, user } = useAuth0();

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin + "/admin" } });
  };

  return (
    <Menu
      align="right"
      trigger={
        <button
          className="group p-2.5 rounded-lg transition-all duration-200 text-dark-400 hover:text-white hover:bg-dark-800/80"
          title={user?.email}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      }
    >
      <div className="px-4 py-3 border-b border-dark-700">
        <p className="text-sm text-dark-400 truncate">{user?.email}</p>
      </div>
      <button
        onClick={handleLogout}
        className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
        </svg>
        {t("auth.signOut")}
      </button>
    </Menu>
  );
}
