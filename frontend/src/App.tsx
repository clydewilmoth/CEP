import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import {
  GetChangesSince,
  GetGlobalLastUpdateTimestamp,
  GetPlatformSpecificUserName,
  InitDB,
} from "../wailsjs/go/main/Core";
import { EventsOn, EventsOff } from "../wailsjs/runtime";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Loader } from "./components/ui/loader";
import { RefreshCcw } from "lucide-react";
import { Button } from "./components/ui/button";
import { ThemeProvider } from "./components/ui/theme-provider";
import { useTheme } from "next-themes";
import { Menu } from "./components/logic/Menu";
import { cn } from "./lib/utils";
import Operation from "./pages/Operation";
import { useContext } from "./store";

const queryClient = new QueryClient();

export default function App() {
  const {
    initialised,
    setInitialised,
    dbState,
    dbChange,
    tryInitialiseListener,
    tryInitialise,
    lastUpdate,
    setLastUpdate,
  } = useContext();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme } = useTheme();

  const lastUpdateRef = useRef(lastUpdate);

  useEffect(() => {
    lastUpdateRef.current = lastUpdate;
  }, [lastUpdate]);

  useEffect(() => {
    !localStorage.getItem("lang")
      ? (localStorage.setItem("lang", "en"), i18n.changeLanguage("en"))
      : i18n.changeLanguage(String(localStorage.getItem("lang")));
    !localStorage.getItem("theme")
      ? setTheme("system")
      : setTheme(String(localStorage.getItem("theme")));
    (async () => {
      !localStorage.getItem("name") &&
        localStorage.setItem("name", await GetPlatformSpecificUserName());
    })();
    EventsOn("database:changed", async (ts: string) => {
      console.log("Last Update: ", lastUpdateRef.current);
      console.log("DB Change: ", ts);
      const changes = await GetChangesSince(lastUpdateRef.current ?? "");
      console.log(changes);
      setLastUpdate(changes.newGlobalLastUpdatedAt);
      dbChange();
    });
    EventsOn("database:connection_lost", (err: string) => {
      console.log("DB Connection Lost: ", err);
      tryInitialise();
    });
    return () => EventsOff("database:changed", "database:connection_lost");
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const initMessage = await InitDB(localStorage.getItem("dsn") ?? "");
      setInitialised(initMessage == "InitSuccess" ? true : false);
      setIsLoading(false);
      setLastUpdate(await GetGlobalLastUpdateTimestamp());
      initMessage == "InitSuccess"
        ? toast.success(t(initMessage))
        : toast.error(t(initMessage));
    })();
  }, [tryInitialiseListener]);
  useEffect(() => {
    queryClient.invalidateQueries();
  }, [dbState]);

  return (
    <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {" "}
        <div
          className={cn(
            "flex flex-row w-full flex-1 mx-auto border border-neutral-200 dark:border-neutral-700 overflow-hidden",
            "h-screen"
          )}
        >
          <Menu />
          <div className="bg-muted border rounded-tl-3xl w-full h-full flex-1 min-w-0 overflow-hidden">
            {isLoading && (
              <div className="py-8 px-4">
                <Button variant="ghost" className="w-fit" disabled>
                  <Loader />
                  {t("InitLoading")}
                </Button>
              </div>
            )}
            {!isLoading && initialised ? (
              <div className="w-full h-full">
                <Route path={"/"} component={Lines} />
                <Route path={"/line/:luuid"} component={Stations} />
                <Route path={"/line/:luuid/station/:suuid"} component={Tools} />
                <Route
                  path={"/line/:luuid/station/:suuid/tool/:tuuid"}
                  component={Operations}
                />
                <Route
                  path={
                    "/line/:luuid/station/:suuid/tool/:tuuid/operation/:ouuid"
                  }
                  component={Operation}
                />
              </div>
            ) : (
              !isLoading &&
              !initialised && (
                <div className="py-8 px-4">
                  <Button
                    variant="ghost"
                    className="w-fit"
                    onClick={() => tryInitialise()}
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
