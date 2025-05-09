import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "wouter";

export default function Lines() {
  const [i, setI] = useState("");

  return (
    <>
      <h1 className="mt-6">All Lines</h1>
      <input
        type="text"
        onChange={(e) => setI(e.target.value)}
        className="border-4"
      />
      <Link href={i === "" ? `/line/error` : `/line/${i}`}>
        <Button className="ml-5 mt-5">{"->"}</Button>
      </Link>
    </>
  );
}
