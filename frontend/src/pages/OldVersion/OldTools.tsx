import { EntityCollection } from "@/components/logic/EntityCollection";
import { StationForm } from "@/components/logic/EntityForms";
import { BreadcrumbNavigationOldVersion } from "@/components/logic/VersionScreen/OldVersionNavigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";

export default function OldTools() {
  const params = useParams<{ vuuid: string; luuid: string; suuid: string }>();
  const { vuuid, luuid, suuid } = params;
  const { t } = useTranslation();

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="w-full h-screen rounded-lg"
    >
      <ResizablePanel
        defaultSize={20}
        className="min-w-72 bg-card rounded-tl-3xl"
      >
        <ResizablePanelGroup direction="vertical">
          <ScrollArea className="p-8">
            <ResizablePanel defaultSize={0} className="min-h-fit">
              <BreadcrumbNavigationOldVersion luuid={luuid} suuid={suuid} />
            </ResizablePanel>
            <ResizableHandle disabled />
            <ResizablePanel defaultSize={100}>
              <StationForm entityId={suuid} />
            </ResizablePanel>
          </ScrollArea>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle disabled />
      <ResizablePanel defaultSize={80}>
        <div className="p-8 bg-muted h-screen flex flex-col gap-5">
          <h1 className="text-xl font-bold">{t("tools")}</h1>
          <EntityCollection
            entityType="tool"
            parentId={suuid}
            link={`/line/${luuid}/station/${suuid}/tool/`}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
