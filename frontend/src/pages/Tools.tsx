import { useParams } from "wouter";

export default function Tools() {
  const params = useParams<{ luuid: string; suuid: string }>();
  const { luuid, suuid } = params;

  return <></>;
}
