import { useEffect, useState } from "react";
import { BreadcrumbWithCustomSeparator } from "../ui/breadcrumb";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { GetEntityDetailsByIDString } from "../../../wailsjs/go/main/Core";

export default function Header() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [titles, setTitles] = useState<string[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<string[]>([]);

  useEffect(() => {
    const parts = location.split("/").filter(Boolean);
    const newTitles: string[] = [];
    const newLinks: string[] = [];

    // Linienübersicht
    if (parts.length >= 2) {
      newTitles.push(parts[1]); // Linien-ID
      newLinks.push(`/line/${parts[1]}`);
    }
    // Stationsübersicht
    if (parts.length >= 4) {
      newTitles.push(parts[3]); // Stations-ID
      newLinks.push(`/line/${parts[1]}/station/${parts[3]}`);
    }
    // Toolübersicht
    if (parts.length >= 6) {
      newTitles.push(parts[5]); // Tool-ID
      newLinks.push(`/line/${parts[1]}/station/${parts[3]}/tool/${parts[5]}`);
    }
    // Operationsübersicht
    if (parts.length >= 8) {
      newTitles.push(parts[7]); // Operations-ID
      newLinks.push(
        `/line/${parts[1]}/station/${parts[3]}/tool/${parts[5]}/operation/${parts[7]}`
      );
    }

    // Breadcrumb-Links für die Navigation:
    // [0]: / (Linienübersicht)
    // [1]: /line/123 (Stationsübersicht)
    // [2]: /line/123/station/456 (Toolübersicht)
    // [3]: /line/123/station/456/tool/789 (Operationsübersicht)
    const breadcrumbLinks: string[] = ["/"];
    if (parts.length >= 2) breadcrumbLinks.push(`/line/${parts[1]}`);
    if (parts.length >= 4)
      breadcrumbLinks.push(`/line/${parts[1]}/station/${parts[3]}`);
    if (parts.length >= 6)
      breadcrumbLinks.push(
        `/line/${parts[1]}/station/${parts[3]}/tool/${parts[5]}`
      );

    setTitles(newTitles);
    setLinks(breadcrumbLinks.slice(1, breadcrumbLinks.length)); // skip '/' for Folder icon
  }, [location]);

  useEffect(() => {
    let isMounted = true;
    async function fetchNames() {
      const names: string[] = [];
      for (let i = 0; i < titles.length; i++) {
        const id = titles[i];
        const link = links[i];
        let entityType = "";
        if (link?.includes("/operation/")) entityType = "operation";
        else if (link?.includes("/tool/")) entityType = "tool";
        else if (link?.includes("/station/")) entityType = "station";
        else if (link?.includes("/line/")) entityType = "line";

        const typeLabel =
          entityType === "line"
            ? "Linie"
            : entityType === "station"
            ? "Station"
            : entityType === "tool"
            ? "Tool"
            : entityType === "operation"
            ? "Operation"
            : entityType;

        if (
          id &&
          (id.match(/^\d+$/) || id.match(/^[a-f0-9-]{24,}$/i)) &&
          entityType
        ) {
          try {
            const entity = await GetEntityDetailsByIDString(
              entityType,
              id.trim()
            );
            names.push(`${typeLabel} (${entity?.Name ?? ""})`);
          } catch {
            names.push(`${typeLabel} ()`);
          }
        } else {
          names.push(`${typeLabel} ()`);
        }
      }
      if (isMounted) setDisplayNames(names);
    }
    if (titles.length > 0) {
      fetchNames();
    } else {
      setDisplayNames([]);
    }
    return () => {
      isMounted = false;
    };
  }, [titles, links]);

  return (
    <div className="text-black font-bold text-5xl w-full flex flex-col items-center justify-start gap-5">
      <div className="text-left w-full">CEP</div>
      <div className="flex flex-col items-center justify-center">
        <div className="min-h-10">
          <BreadcrumbWithCustomSeparator titles={displayNames} links={links} />
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
