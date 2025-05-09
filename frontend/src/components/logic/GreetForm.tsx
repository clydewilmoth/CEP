import { useState } from "react";
import { Greet } from "../../../wailsjs/go/main/App";
import { Button } from "../ui/button";

export default function GreetForm() {
  const [i, setI] = useState("");
  const [greeted, setGreeted] = useState("");

  return (
    <>
      <h1>Demo Binding Function</h1>
      <input
        type="text"
        onChange={(e) => setI(e.target.value)}
        className="border-4"
      />
      <Button onClick={async () => setGreeted(await greet(i))} className="ml-5">
        Greet
      </Button>
      <h1>{greeted}</h1>
    </>
  );
}

const greet = async (name: string) => {
  return await Greet(name);
};
