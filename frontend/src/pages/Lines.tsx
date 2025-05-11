import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import EntityCard from "../components/logic/EntityCard";
import EntityForm from "@/components/logic/EntityForm";
import {
  GetAllEntitiesByTypeString,
  CreateEntity,
  DeleteEntityByIDString,
  GetEntityDetailsByIDString,
} from "../../wailsjs/go/main/Core";

export default function Lines() {
  const { t } = useTranslation();
  const [observer, setObserver] = useState(0);
  const [lines, setLines] = useState<any[]>();
  const [selectedEntityID, setSelectedEntityID] = useState("");
  const [selectedFields, setSelectedFields] = useState({});

  useEffect(() => {
    const fetch = async () => {
      const res = await GetAllEntitiesByTypeString("line");
      setLines(res);
    };
    fetch();
  }, [observer]);

  return (
    <>
      <div className="flex flex-wrap gap-5">
        {selectedEntityID != "" ? (
          <EntityForm
            entity="line"
            entityID={selectedEntityID}
            fields={selectedFields}
          />
        ) : (
          ""
        )}
        {lines?.map((element, index) => (
          <EntityCard
            name={element.Name}
            description={element.Description}
            onClick={() => setObserver(observer + 1)}
            tOnClick={async () => {
              await DeleteEntityByIDString("line", element.ID);
              setObserver(observer + 1);
            }}
            eOnClick={async () => {
              setSelectedEntityID(element.ID);
              setSelectedFields(
                await GetEntityDetailsByIDString("line", element.ID)
              );
            }}
            add={false}
            key={index}
          />
        ))}
        <EntityCard
          name=""
          description=""
          onClick={async () => {
            await CreateEntity("line", "");
            setObserver(observer + 1);
          }}
          add={true}
        />
      </div>
    </>
  );
}

/* <Link href={i === "" ? `/line/blank` : `/line/${i}`}>
      <Button className="ml-5 mt-5">{"->"}</Button>
  </Link>*/
