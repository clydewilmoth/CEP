import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import {
  GetChangesSince,
  GetEntityDetails,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { ScrollArea } from "@radix-ui/react-scroll-area";

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

  const [draftConflictMountKey, setDraftConflictMountKey] = useState(0);
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
      setDraftConflictMountKey((prev) => prev + 1);
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
      !localStorage.getItem("lastUpdate") &&
        localStorage.setItem(
          "lastUpdate",
          await GetGlobalLastUpdateTimestamp()
        );
      setLastUpdate(localStorage.getItem("lastUpdate") ?? "");
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
                <DraftConflictDialog key={draftConflictMountKey} />
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

function DraftConflictDialog() {
  const { t } = useTranslation();
  const [draftConflicts, setDraftConflicts] = useState<Record<string, string>>(
    {}
  );
  const [open, setOpen] = useState(false);
  const { lastUpdate, setLastUpdate } = useContext();

  useEffect(() => {
    (async () => {
      const { deletedEntities, updatedEntities, newGlobalLastUpdatedAt } =
        await GetChangesSince(lastUpdate ?? "");

      if (newGlobalLastUpdatedAt != lastUpdate) {
        localStorage.setItem("lastUpdate", newGlobalLastUpdatedAt);
        setLastUpdate(newGlobalLastUpdatedAt);
        let conflictCounter = 1;
        let conflicts: Record<string, string> = {};

        Object.entries(deletedEntities).forEach(([, ids]) => {
          ids.forEach((id) => {
            if (localStorage.getItem(`${id}`)) {
              localStorage.removeItem(`${id}`);
            }
          });
        });
        for (const [entityType, entities] of Object.entries(updatedEntities)) {
          for (const entity of entities) {
            if (
              JSON.parse(localStorage.getItem(`${entity.id}`) ?? "{}") != "{}"
            ) {
              const localEntity = JSON.parse(
                localStorage.getItem(`${entity.id}`) ?? "{}"
              );
              const { Name: dbName } = await GetEntityDetails(
                entityType,
                entity.id
              );
              const Name = localEntity.Name ?? dbName;
              Object.entries(entity.changedFields || {}).forEach(
                ([field, value]) => {
                  if (localEntity[field]) {
                    conflicts[
                      `${conflictCounter}<><><>${t(entityType)} ${Name}`
                    ] = `${t(field)}<><><>${value}`;

                    conflictCounter++;
                  }
                }
              );
            }
          }
        }
        setDraftConflicts(conflicts);
        setOpen(Object.keys(conflicts).length > 0);
      }
    })();
  }, []);

  let prevKey = "";

  return (
    <>
      {Object.keys(draftConflicts).length !== 0 && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogTitle className="font-bold">
              {t("DraftConflicts Title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("DraftConflicts Description")}
            </AlertDialogDescription>{" "}
            <div className="py-3 flex flex-col gap-2">
              {Object.entries(draftConflicts).map(([key, value]) => {
                const keyWithoutCounter = key.split("<><><>")[1];
                const showKey = keyWithoutCounter != prevKey;

                if (showKey) {
                  prevKey = keyWithoutCounter;
                }
                return (
                  <>
                    {showKey && (
                      <div
                        key={key}
                        className="font-bold"
                      >{`${keyWithoutCounter}: `}</div>
                    )}
                    <div key={key + value} className="text-sm">
                      {`${t(value.split("<><><>")[0])}: ${t(
                        value.split("<><><>")[1]
                      )}`}
                    </div>
                  </>
                );
              })}
            </div>
            <Button
              variant="outline"
              type="submit"
              className="w-1/3 mx-auto"
              onClick={() => setOpen(false)}
            >
              {t("Understood")}
            </Button>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
