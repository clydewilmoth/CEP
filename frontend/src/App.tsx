import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import { Header } from "./components/logic/Header";
import { CheckEnvInExeDir, InitDB } from "../wailsjs/go/main/Core";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader } from "./components/ui/loader";
import { RefreshCcw } from "lucide-react";
import { Button } from "./components/ui/button";

const queryClient = new QueryClient();

function App() {
  const { initialised, setInitialised, setDsnOpen, appRender, appRerender } =
    useInit();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.getItem("lang") == null
      ? i18n.changeLanguage("en")
      : i18n.changeLanguage(String(localStorage.getItem("lang")));
    const init = async () => {
      (await CheckEnvInExeDir())
        ? (async () => {
            const initMessage = await InitDB();
            setInitialised(false);
            setIsLoading(false);
            toast(t(initMessage));
            initMessage == "InitSuccess" && setInitialised(true);
            setDsnOpen(false);
          })()
        : setDsnOpen(true);
    };
    init();
  }, [appRender]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col items-center justify-start w-full h-screen gap-10 p-12">
        <Header />
        {isLoading && (
          <div className="flex flex-row items-center justify-center gap-4 font-semibold">
            <Loader />
            <p>{t("InitLoading")}</p>
          </div>
        )}
        {initialised ? (
          <div className="w-full">
            <Route path={"/"}>
              <Lines />
            </Route>
            <Route path={"/line/:luuid"}>
              <Stations />
            </Route>
            <Route path={"/line/:luuid/station/:suuid"}>
              <Tools />
            </Route>
            <Route path={"/line/:luuid/station/:suuid/tool/:tuuid"}>
              <Operations />
            </Route>
          </div>
        ) : (
          !isLoading &&
          !initialised && (
            <Button
              variant="outline"
              onClick={() => (setIsLoading(true), appRerender())}
            >
              <RefreshCcw />
              {t("InitReload")}
            </Button>
          )
        )}
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export const useInit = create<{
  initialised: boolean;
  setInitialised: (initialised: boolean) => void;
  dsnOpen: boolean;
  setDsnOpen: (open: boolean) => void;
  appRender: number;
  appRerender: () => void;
}>((set) => ({
  initialised: false,
  setInitialised: (initialised) => set({ initialised }),
  dsnOpen: false,
  setDsnOpen: (open) => set({ dsnOpen: open }),
  appRender: 0,
  appRerender: () => set((state) => ({ appRender: state.appRender + 1 })),
}));

export default App;
