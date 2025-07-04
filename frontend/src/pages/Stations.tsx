import { EntityCollection } from "@/components/logic/EntityCollection";
import { LineForm } from "@/components/logic/EntityForms";
import { BreadcrumbNavigation } from "@/components/logic/Navigation";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "wouter";

export default function Stations() {
  const params = useParams<{ luuid: string }>();
  const { luuid } = params;

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
              <BreadcrumbNavigation luuid={luuid} />
            </ResizablePanel>
            <ResizableHandle disabled />
            <ResizablePanel defaultSize={100}>
              <LineForm entityId={luuid} />
            </ResizablePanel>
          </ScrollArea>
        </ResizablePanelGroup>
      </ResizablePanel>
      <ResizableHandle disabled />
      <ResizablePanel defaultSize={80}>
        <div className="p-8 bg-muted h-screen">
          <EntityCollection
            entityType="station"
            parentId={luuid}
            link={`/line/${luuid}/station/`}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
