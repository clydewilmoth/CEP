import { useEffect, useState } from "react";
import { UpdateEntityFieldsString } from "../../../wailsjs/go/main/Core";

export default function EntityForm({
  entity,
  entityID,
  fields,
}: {
  entity: string;
  entityID: string;
  fields: {};
}) {
  return (
    <div className="flex flex-col justify-center items-center p-10 gap-3 bg-black text-white rounded-xl">
      {Object.entries(fields).map(([key, value]) => {
        if (
          key === "ID" ||
          key === "CreatedAt" ||
          key === "UpdatedAt" ||
          key === "Stations"
        ) {
          return null;
        }
        // Lokaler State pro Feld
        const [inputValue, setInputValue] = useState(String(value));

        return (
          <div key={key}>
            <h1>{key}</h1>
            <input
              type="text"
              value={inputValue}
              onChange={async (e) => {
                setInputValue(e.target.value);
                await UpdateEntityFieldsString(entity, entityID, {
                  [key]: e.target.value,
                });
              }}
              className="bg-black"
            />
          </div>
        );
      })}
    </div>
  );
}
