import { EntityCollection } from "@/components/logic/EntityCollection";
import { ToolForm } from "@/components/logic/EntityForms";
import { BreadcrumbNavigation } from "@/components/logic/Navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "wouter";

export default function Operations() {
  const params = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { luuid, suuid, tuuid } = params;

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
              <BreadcrumbNavigation luuid={luuid} suuid={suuid} tuuid={tuuid} />
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
        <div className="p-8 bg-muted h-screen">
          <EntityCollection
            entityType="operation"
            parentId={tuuid}
            link={`/line/${luuid}/station/${suuid}/tool/${tuuid}/operation/`}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
