import { EntityCollection } from "@/components/logic/EntityCollection";
import { LineForm } from "@/components/logic/EntityForms";
import { BreadcrumbNavigationOldVersion } from "@/components/logic/VersionScreen/OldVersionNavigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";


export default function OldLines() {
  const params = useParams<{ vuuid: string }>();
  const { vuuid } = params;
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
            <ResizablePanel defaultSize={0} className="min-h-fit min-w-fit">
              <BreadcrumbNavigationOldVersion vuuid={vuuid} />
            </ResizablePanel>
            <ResizableHandle disabled />
            <ResizablePanel defaultSize={100}>
              <LineForm entityId={vuuid} />
            </ResizablePanel>
          </ScrollArea>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle disabled />
      <ResizablePanel defaultSize={80}>
        <div className="p-8 bg-muted h-screen flex flex-col gap-5">
          <h1 className="text-xl font-bold">{t("stations")}</h1>
          <EntityCollection
            entityType="station"
            parentId={vuuid}
            link={`/line/${vuuid}/station/`}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
