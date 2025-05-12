import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import Header from "./components/logic/Header";
import { HandleExport, InitDB, HandleImport } from "../wailsjs/go/main/Core";
import { useEffect, useState } from "react";
import { Button } from "./components/ui/button";
import { GetEntityHierarchyString } from "../wailsjs/go/main/Core";

function App() {
  const [initialised, setInitialised] = useState(false);
  const [context, setContext] = useState(0);

  useEffect(() => {
    const init = async () => {
      await InitDB();
      setInitialised(true);
    };
    init();
  }, []);

  return (
    <div className="flex flex-col items-center justify-start w-full h-screen gap-10 p-10">
      <Header context={context} updateContext={() => setContext(context + 1)} />
      {initialised && (
        <div>
          <Route path={"/"}>
            <Lines
              context={context}
              updateContext={() => setContext(context + 1)}
            />
          </Route>
          <Route path={"/line/:luuid"}>
            <Stations
              context={context}
              updateContext={() => setContext(context + 1)}
            />
          </Route>
          <Route path={"/line/:luuid/station/:suuid"}>
            <Tools
              context={context}
              updateContext={() => setContext(context + 1)}
            />
          </Route>
          <Route path={"/line/:luuid/station/:suuid/tool/:tuuid"}>
            <Operations
              context={context}
              updateContext={() => setContext(context + 1)}
            />
          </Route>
        </div>
      )}
    </div>
  );
}

export default App;
