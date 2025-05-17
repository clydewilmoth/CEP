import { EntityCollection } from "@/components/logic/EntityCollection";
import { useParams } from "wouter";

export default function Tools() {
  const params = useParams<{ luuid: string; suuid: string }>();
  const { luuid, suuid } = params;

  return (
    <EntityCollection
      entityType="tool"
      parentId={suuid}
      link={`/line/${luuid}/station/${suuid}/tool/`}
    />
  );
}
