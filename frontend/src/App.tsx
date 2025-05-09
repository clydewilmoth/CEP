import "./App.css";
import { Greet } from "../wailsjs/go/main/App";
import { useState } from "react";
import { Button } from "@/components/ui/button";

function App() {
  const [name, setName] = useState("");
  const [i, setI] = useState("");

  async function greet(name: string) {
    const greeted = await Greet(name);
    setName(greeted);
  }

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 place-items-center justify-items-center mx-auto py-8">
      <div className="text-blue-900 text-2xl font-bold font-mono">
        <input
          className="border-2 border-blue-900 rounded-md p-2 mr-2"
          type="text"
          value={i}
          onChange={(e) => {
            setI(e.target.value);
          }}
        />
        <Button onClick={() => greet(i)}>Greet</Button>
        <h1 className="content-center">{name}</h1>
      </div>
    </div>
  );
}

export default App;
