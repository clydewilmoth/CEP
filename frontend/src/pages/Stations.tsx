import { EntityCollection } from "@/components/logic/EntityCollection";
import { useParams } from "wouter";

export default function Stations() {
  const params = useParams<{ luuid: string }>();
  const { luuid } = params;

  return (
    <EntityCollection
      entityType="station"
      parentId={luuid}
      link={`/line/${luuid}/station/`}
    />
  );
}
