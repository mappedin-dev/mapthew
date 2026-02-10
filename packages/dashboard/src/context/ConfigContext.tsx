import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

/**
 * Capitalize first letter of a string (for display name)
 */
function toDisplayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

interface ConfigContextValue {
  botName: string;
  botDisplayName: string;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextValue>({
  botName: "mapthew",
  botDisplayName: "Mapthew",
  isLoading: true,
});

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
    staleTime: 30000,
  });

  const botName = data?.botName ?? "mapthew";
  const value: ConfigContextValue = {
    botName,
    botDisplayName: toDisplayName(botName),
    isLoading,
  };

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
