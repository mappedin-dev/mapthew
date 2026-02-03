import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

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

  const value: ConfigContextValue = {
    botName: data?.botName ?? "mapthew",
    botDisplayName: data?.botDisplayName ?? "Mapthew",
    isLoading,
  };

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
