import EntityCollection from "@/components/logic/EntityCollection";

export default function Lines({
  context,
  updateContext,
}: {
  context?: number;
  updateContext?: () => void;
}) {
  return (
    <EntityCollection
      entity="line"
      parentID=""
      link="/line/"
      context={context}
      updateContext={updateContext}
    />
  );
}
