import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link, useParams } from "wouter";

export default function Stations() {
  const params = useParams<{ luuid: string }>();
  const { luuid } = params;

  const [i, setI] = useState("");

  return (
    <>
      <input
        type="text"
        onChange={(e) => setI(e.target.value)}
        className="border-4"
      />
      <Link
        href={
          i === ""
            ? `/line/${luuid}/station/blank`
            : `/line/${luuid}/station/${i}`
        }
      >
        <Button className="ml-5 mt-5">{"->"}</Button>
      </Link>
    </>
  );
}
