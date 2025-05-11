import { useParams } from "wouter";
import EntityCollection from "@/components/logic/EntityCollection";

export default function Stations() {
  const params = useParams<{ luuid: string }>();
  const { luuid } = params;

  return (
    <EntityCollection
      entity="station"
      parentID={luuid}
      link={`/line/${luuid}/station/`}
    />
  );
}
