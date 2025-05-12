import { useParams } from "wouter";
import EntityCollection from "@/components/logic/EntityCollection";

export default function Operations({
  context,
  updateContext,
}: {
  context?: number;
  updateContext?: () => void;
}) {
  const params = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { luuid, suuid, tuuid } = params;

  return (
    <EntityCollection
      entity="operation"
      parentID={tuuid}
      link=""
      context={context}
      updateContext={updateContext}
    />
  );
}
