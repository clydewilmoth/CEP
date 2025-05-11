import { useParams } from "wouter";
import EntityCollection from "@/components/logic/EntityCollection";

export default function Tools() {
  const params = useParams<{ luuid: string; suuid: string }>();
  const { luuid, suuid } = params;

  return (
    <EntityCollection
      entity="tool"
      parentID={suuid}
      link={`/line/${luuid}/station/${suuid}/tool/`}
    />
  );
}
