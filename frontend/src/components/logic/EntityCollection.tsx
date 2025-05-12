import { useEffect, useState } from "react";
import EntityCard from "./EntityCard";
import EntityForm from "./EntityForm";
import {
  GetAllEntitiesByTypeString,
  CreateEntity,
  DeleteEntityByIDString,
  GetEntityDetailsByIDString,
  GetChildEntitiesString,
  HandleExport,
} from "../../../wailsjs/go/main/Core";
import { useLocation } from "wouter";

export default function EntityCollection({
  entity,
  parentID,
  link,
  context,
  updateContext,
}: {
  entity: string;
  parentID: string;
  link: string;
  context?: number;
  updateContext?: () => void;
}) {
  const [observer, setObserver] = useState(0);
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntityID, setSelectedEntityID] = useState("");
  const [selectedFields, setSelectedFields] = useState({});

  const [location, navigate] = useLocation();

  useEffect(() => {
    const fetch = async () => {
      const res =
        entity == "line"
          ? await GetAllEntitiesByTypeString(entity)
          : await GetChildEntitiesString(parentID, entity);
      setEntities(res);
    };
    fetch();
  }, [observer, location, context]);

  return (
    <>
      <div className="flex gap-5 flex-wrap">
        {selectedEntityID !== "" && Object.keys(selectedFields).length > 0 ? (
          <EntityForm
            entity={entity}
            entityID={selectedEntityID}
            fields={selectedFields}
            onClose={() => {
              setSelectedEntityID("");
              setSelectedFields({});
              setObserver(observer + 1);
            }}
          />
        ) : (
          entities != null &&
          entities.map((element, index) => (
            <EntityCard
              name={element.Name}
              description={element.Description}
              onClick={() => {
                link != "" && navigate(`${link}${element.ID}`);
              }}
              tOnClick={async () => {
                await DeleteEntityByIDString(entity, element.ID);
                setObserver(observer + 1);
              }}
              eOnClick={async () => {
                setSelectedEntityID(element.ID);
                setSelectedFields(
                  await GetEntityDetailsByIDString(entity, element.ID)
                );
              }}
              exOnClick={async () => {
                await HandleExport(entity, element.ID);
              }}
              add={false}
              key={index}
            />
          ))
        )}
        {selectedEntityID == "" && (
          <EntityCard
            name=""
            description=""
            onClick={async () => {
              const res = await CreateEntity(
                String(localStorage.getItem("user")),
                entity,
                parentID
              );
              const fields = await GetEntityDetailsByIDString(entity, res);
              setSelectedEntityID(res);
              setSelectedFields(fields);
              setObserver(observer + 1);
            }}
            add={true}
            tOnClick={() => {}}
            eOnClick={() => {}}
            exOnClick={() => {}}
          />
        )}
      </div>
    </>
  );
}
