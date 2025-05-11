import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import Header from "./components/logic/Header";
import { InitDB } from "../wailsjs/go/main/Core";
import { useEffect, useState } from "react";

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
    </div>
  );
}

export default App;
