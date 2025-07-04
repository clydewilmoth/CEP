import { EntityCollection } from "@/components/logic/EntityCollection";
import { StationForm } from "@/components/logic/EntityForms";
import { BreadcrumbNavigation } from "@/components/logic/Navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "wouter";

export default function Tools() {
  const params = useParams<{ luuid: string; suuid: string }>();
  const { luuid, suuid } = params;

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
              <BreadcrumbNavigation luuid={luuid} suuid={suuid} />
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
        <div className="p-8 bg-muted h-screen">
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
