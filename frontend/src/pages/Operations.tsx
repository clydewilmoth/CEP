import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link, useParams } from "wouter";

export default function Operations() {
  const params = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { luuid, suuid, tuuid } = params;

  return (
    <>
      <h1>
        Operations of Tool {tuuid} of Station {suuid} of Line {luuid}
        <Link href={`/line/${luuid}/station/${suuid}`}>
          <Button className="ml-5 mt-5">{"<-"}</Button>
        </Link>
      </h1>
    </>
  );
}
