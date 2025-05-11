import { useParams } from "wouter";
import EntityCollection from "@/components/logic/EntityCollection";

export default function Operations() {
  const params = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { luuid, suuid, tuuid } = params;

  return <EntityCollection entity="operation" parentID={tuuid} link="" />;
}
