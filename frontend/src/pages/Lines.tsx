import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export default function Lines() {
  const { t } = useTranslation();
  const [i, setI] = useState("");

  return (
    <>
      <input
        type="text"
        onChange={(e) => setI(e.target.value)}
        className="border-4"
      />
      <Link href={i === "" ? `/line/blank` : `/line/${i}`}>
        <Button className="ml-5 mt-5">{"->"}</Button>
      </Link>
    </>
  );
}
