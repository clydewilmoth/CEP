import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import {
  CheckEnvInExeDir,
  GetPlatformSpecificUserName,
  InitDB,
} from "../wailsjs/go/main/Core";
import { EventsOn, EventsOff } from "../wailsjs/runtime";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader } from "./components/ui/loader";
import { RefreshCcw } from "lucide-react";
import { Button } from "./components/ui/button";
import { ThemeProvider } from "./components/ui/theme-provider";
import { useTheme } from "next-themes";
import { Sidebar, SidebarBody, SidebarMenu } from "./components/ui/sidebar";
import {
  DSNDialog,
  LangDialog,
  ThemeSwitch,
  UserDialog,
} from "./components/logic/Menu";
import { cn } from "./lib/utils";
import Operation from "./pages/Operation";

const queryClient = new QueryClient();

function App() {
  const {
    initialised,
    setInitialised,
    setDsnOpen,
    appRender,
    appRerender,
    dbChange,
  } = useInit();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme } = useTheme();

  const handler = (ts: string) => {
    console.log("DB Change: ", ts);
    queryClient.invalidateQueries();
    dbChange();
  };

  useEffect(() => {
    EventsOn("database:changed", handler);
    return () => EventsOff("database:changed");
  }, []);

  useEffect(() => {
    localStorage.getItem("lang") == null
      ? i18n.changeLanguage("en")
      : i18n.changeLanguage(String(localStorage.getItem("lang")));
    localStorage.getItem("theme") == null
      ? setTheme("light")
      : setTheme(String(localStorage.getItem("theme")));
    (async () => {
      localStorage.getItem("name") == null &&
        localStorage.setItem("name", await GetPlatformSpecificUserName());
    })();
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

  const [open, setOpen] = useState(false);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <div
          className={cn(
            "flex flex-col md:flex-row w-full flex-1 mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
            "h-screen"
          )}
        >
          <Sidebar open={open} setOpen={setOpen}>
            <SidebarBody className="justify-between gap-10 overflow-hidden">
              <div className="flex flex-col">
                <SidebarMenu item={<DSNDialog />} text={t("Database")} />
                <SidebarMenu item={<LangDialog />} text={t("Language")} />
                <SidebarMenu item={<ThemeSwitch />} text={t("Theme")} />
              </div>
              <SidebarMenu
                item={<UserDialog />}
                text={localStorage.getItem("name") ?? ""}
              />
            </SidebarBody>
          </Sidebar>
          <div className="bg-muted border rounded-tl-3xl w-full h-full">
            {isLoading && (
              <div className="py-8 px-4">
                <Button variant="ghost" className="w-fit" disabled>
                  <Loader />
                  {t("InitLoading")}
                </Button>
              </div>
            )}
            {initialised ? (
              <div className="w-full h-full">
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
                <Route
                  path={
                    "/line/:luuid/station/:suuid/tool/:tuuid/operation/:ouuid"
                  }
                >
                  <Operation />
                </Route>
              </div>
            ) : (
              !isLoading &&
              !initialised && (
                <div className="py-8 px-4">
                  <Button
                    variant="ghost"
                    className="w-fit"
                    onClick={() => (setIsLoading(true), appRerender())}
                  >
                    <RefreshCcw />
                    {t("InitReload")}
                  </Button>
                </div>
              )
            )}
            <Toaster />
          </div>
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export const useInit = create<{
  initialised: boolean;
  setInitialised: (initialised: boolean) => void;
  dsnOpen: boolean;
  setDsnOpen: (open: boolean) => void;
  appRender: number;
  appRerender: () => void;
  dbState: number;
  dbChange: () => void;
}>((set) => ({
  initialised: false,
  setInitialised: (initialised) => set({ initialised }),
  dsnOpen: false,
  setDsnOpen: (open) => set({ dsnOpen: open }),
  appRender: 0,
  appRerender: () => set((state) => ({ appRender: state.appRender + 1 })),
  dbState: 0,
  dbChange: () => set((state) => ({ dbState: state.dbState + 1 })),
}));

export default App;
