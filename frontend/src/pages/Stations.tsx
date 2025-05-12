import { useParams } from "wouter";
import EntityCollection from "@/components/logic/EntityCollection";

export default function Stations({
  context,
  updateContext,
}: {
  context?: number;
  updateContext?: () => void;
}) {
  const params = useParams<{ luuid: string }>();
  const { luuid } = params;

  return (
    <EntityCollection
      entity="station"
      parentID={luuid}
      link={`/line/${luuid}/station/`}
      context={context}
      updateContext={updateContext}
    />
  );
}
