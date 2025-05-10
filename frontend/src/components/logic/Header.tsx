import { useEffect, useState } from "react";
import { BreadcrumbWithCustomSeparator } from "../ui/breadcrumb";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

export default function Header() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [titles, setTitles] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);

  useEffect(() => {
    setTitles(
      location
        .split("/")
        .map((element, index) =>
          index % 2 == 1 ? element : " " + element + ";"
        )
        .join("")
        .split(";")
    );

    const linksMem: string[] = [];
    for (let i = 0; i < location.split("/").length; i = i + 2) {
      linksMem.push(
        location
          .split("/")
          .slice(1, location.split("/").length - i)
          .join("/")
      );
    }
    setLinks(linksMem.reverse());
  }, [location]);

  return (
    <div className=" text-black font-bold text-5xl p-10 w-full flex flex-col items-center justify-start gap-5">
      <div className="text-left w-full">CEP</div>
      <div className="flex flex-col items-center justify-center">
        <div className="min-h-10">
          <BreadcrumbWithCustomSeparator titles={titles} links={links} />
        </div>
        <div className="text-3xl font-display">
          {location.split("/").length < 3
            ? t("lines")
            : location.split("/").length < 4
            ? t("stations")
            : location.split("/").length < 6
            ? t("tools")
            : t("operations")}
        </div>
      </div>
    </div>
  );
}
