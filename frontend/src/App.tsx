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
          <Route path={"/"} component={Lines} />
          <Route path={"/line/:luuid"} component={Stations} />
          <Route path={"/line/:luuid/station/:suuid"} component={Tools} />
          <Route
            path={"/line/:luuid/station/:suuid/tool/:tuuid"}
            component={Operations}
          />
        </div>
      )}
      <Button
        onClick={async () => {
          await HandleExport("line", "8a0e88e5-176f-45ea-88c2-e2774e8c4b1b");
        }}
      >
        Export
      </Button>
      <Button
        onClick={async () => {
          await HandleImport("Selim");
        }}
      >
        Import
      </Button>
    </div>
  );
}

export default App;
