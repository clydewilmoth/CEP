import { useParams } from "wouter";

export default function Stations() {
  const params = useParams<{ luuid: string }>();
  const { luuid } = params;

  return <></>;
}
