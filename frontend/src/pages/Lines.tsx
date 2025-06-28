import { EntityCollection } from "@/components/logic/EntityCollection";

export default function Lines() {
  return (
    <div className="p-8 bg-muted h-screen rounded-tl-3xl">
      <EntityCollection entityType="line" parentId="" link="/line/" />
    </div>
  );
}
