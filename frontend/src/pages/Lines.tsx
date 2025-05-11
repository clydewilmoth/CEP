import EntityCollection from "@/components/logic/EntityCollection";

export default function Lines() {
  return <EntityCollection entity="line" parentID="" />;
}

/* <Link href={i === "" ? `/line/blank` : `/line/${i}`}>
      <Button className="ml-5 mt-5">{"->"}</Button>
  </Link>*/
