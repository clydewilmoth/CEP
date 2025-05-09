import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link, useParams } from "wouter";

export default function Tools() {
  const params = useParams<{ luuid: string; suuid: string }>();
  const { luuid, suuid } = params;

  const [i, setI] = useState("");

  return (
    <>
      <h1>
        Tools of Station {suuid} of Line {luuid}
        <Link href={`/line/${luuid}`}>
          <Button className="ml-5 mt-5">{"<-"}</Button>
        </Link>
      </h1>
      <input
        type="text"
        onChange={(e) => setI(e.target.value)}
        className="border-4"
      />
      <Link
        href={
          i === ""
            ? `/line/${luuid}/station/${suuid}/tool/error`
            : `/line/${luuid}/station/${suuid}/tool/${i}`
        }
      >
        <Button className="ml-5 mt-5">{"->"}</Button>
      </Link>
    </>
  );
}
