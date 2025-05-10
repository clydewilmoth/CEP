import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";

export default function Tools() {
  const params = useParams<{ luuid: string; suuid: string }>();
  const { luuid, suuid } = params;
  const { t } = useTranslation();

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
            ? `/line/${luuid}/station/${suuid}/tool/blank`
            : `/line/${luuid}/station/${suuid}/tool/${i}`
        }
      >
        <Button className="ml-5 mt-5">{"->"}</Button>
      </Link>
    </>
  );
}
