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

const queryClient = new QueryClient();

function App() {
  const [initialised, setInitialised] = useState(false);
  const { setDsnOpen } = useInit();
  const { initSignal } = useSignal();

  useEffect(() => {
    const init = async () => {
      (await CheckEnvInExeDir())
        ? (await InitDB(), setInitialised(true), setDsnOpen(false))
        : setDsnOpen(true);
    };

    init();
  }, [initSignal]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex flex-col items-center justify-start w-full h-screen gap-10 p-12">
        <Header />
        {initialised && (
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
        )}
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export const useInit = create<{
  dsnOpen: boolean;
  setDsnOpen: (open: boolean) => void;
}>((set) => ({
  dsnOpen: false,
  setDsnOpen: (open) => set({ dsnOpen: open }),
}));

export const useSignal = create<{
  initSignal: number;
  increment: () => void;
}>((set) => ({
  initSignal: 0,
  increment: () => set((state) => ({ initSignal: state.initSignal + 1 })),
}));

export default App;
