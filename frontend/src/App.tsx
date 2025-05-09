import { Route } from "wouter";
import Lines from "./pages/Lines";
import Stations from "./pages/Stations";
import Tools from "./pages/Tools";
import Operations from "./pages/Operations";
import GreetForm from "./components/logic/GreetForm";

function App() {
  return (
    <>
      <h1>{"[Login Window]"}</h1>
      <h1>{"[Header]"}</h1>
      <br />
      <Route path={"/"} component={Lines} />
      <Route path={"/line/:luuid"} component={Stations} />
      <Route path={"/line/:luuid/station/:suuid"} component={Tools} />
      <Route
        path={"/line/:luuid/station/:suuid/tool/:tuuid"}
        component={Operations}
      />
      <br />
      <br />
      <GreetForm />
    </>
  );
}

export default App;
