import { EntityCollection } from "@/components/logic/EntityCollection";
import { ToolForm } from "@/components/logic/EntityForms";
import { BreadcrumbNavigationOldVersion } from "@/components/logic/VersionScreen/OldVersionNavigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";

export default function OldOperations() {
  const params = useParams<{ vuuid: string; luuid: string; suuid: string; tuuid: string }>();
  const { vuuid, luuid, suuid, tuuid } = params;
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
              <BreadcrumbNavigationOldVersion luuid={luuid} suuid={suuid} tuuid={tuuid} />
            </ResizablePanel>
            <ResizableHandle disabled />
            <ResizablePanel defaultSize={100}>
              <ToolForm entityId={tuuid} />
            </ResizablePanel>
          </ScrollArea>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle disabled />
      <ResizablePanel defaultSize={80}>
        <ScrollArea>
          <div className="p-8 bg-muted h-screen flex flex-col gap-5">
            <h1 className="text-xl font-bold">{t("operations")}</h1>
            <EntityCollection
              entityType="operation"
              parentId={tuuid}
              link={`/line/${luuid}/station/${suuid}/tool/${tuuid}/operation/`}
            />
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
