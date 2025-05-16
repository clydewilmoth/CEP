import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import Header from "./components/logic/Header";
import { InitDB } from "../wailsjs/go/main/Core";
import { useEffect, useState } from "react";
import { create } from "zustand";

function App() {
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    const init = async () => {
      await InitDB();
      setInitialised(true);
    };
    init();
  }, []);

  return (
    <div className="flex flex-col items-center justify-start w-full h-screen gap-10 p-10">
      <Header />
      {initialised && (
        <div>
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
    </div>
  );
}

export const useContext = create<{
  context: number;
  increase: () => void;
}>((set) => ({
  context: 0,
  increase: () => set((state) => ({ context: state.context + 1 })),
}));

export default App;
