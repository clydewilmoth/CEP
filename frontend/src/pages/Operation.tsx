import { OperationForm } from "@/components/logic/EntityForms";
import { SequenceGroupView } from "@/components/logic/SequenceGroupView";
import { BreadcrumbNavigation } from "@/components/logic/Navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "wouter";
import { useTranslation } from "react-i18next";

export default function Operations() {
  const params = useParams<{
    luuid: string;
    suuid: string;
    tuuid: string;
    ouuid: string;
  }>();
  const { luuid, suuid, tuuid, ouuid } = params;
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
              <BreadcrumbNavigation
                luuid={luuid}
                suuid={suuid}
                tuuid={tuuid}
                ouuid={ouuid}
              />
            </ResizablePanel>
            <ResizableHandle disabled />
            <ResizablePanel defaultSize={100}>
              <OperationForm entityId={ouuid} suuid={suuid} />
            </ResizablePanel>
          </ScrollArea>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle disabled />
      <ResizablePanel>
        <ScrollArea>
          <div className="p-8 bg-muted h-screen w-full">
            <h1 className="text-xl font-bold">{t("sequenceGroups")}</h1>
              <SequenceGroupView
                entityType="sequencegroup"
                parentId={suuid}
              />
          </div>
        </ScrollArea>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
