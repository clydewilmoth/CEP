import { EntityCollection } from "@/components/logic/EntityCollection";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

export default function Lines() {
  const { t } = useTranslation();

  return (
    <div className="p-8 bg-muted h-screen flex flex-col gap-5 rounded-tl-3xl">
      <h1 className="text-xl font-bold">{t("lines")}</h1>
      <EntityCollection entityType="line" parentId="" link="/line/" />
    </div>
  );
}
