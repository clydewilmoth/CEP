import { EntityCollection } from "@/components/logic/EntityCollection";
import { useParams } from "wouter";

export default function Operations() {
  const params = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { luuid, suuid, tuuid } = params;

  return <EntityCollection entityType="operation" parentId={tuuid} link="" />;
}
