import { useState } from "react";
import { UpdateEntityFieldsString } from "../../../wailsjs/go/main/Core";
import { Undo2 } from "lucide-react";
import { Button } from "../ui/button";

export default function EntityForm({
  entity,
  entityID,
  fields,
  onClose,
}: {
  entity: string;
  entityID: string;
  fields: {};
  onClose: () => void;
}) {
  return (
    <div className="w-screen h-screen fixed bg-white">
      <div className="flex flex-col justify-center items-center p-10 gap-3 bg-white text-black shadow-xl border-2 rounded-lg fixed left-1/2 translate-x-[-50%]">
        <Button
          className="rounded-lg bg-black text-white p-1 w-8 h-8"
          onClick={onClose}
        >
          <Undo2 />
        </Button>

        {Object.entries(fields).map(([key, value]) => {
          if (
            key === "ID" ||
            key === "CreatedAt" ||
            key === "UpdatedAt" ||
            key === "Stations" ||
            key === "ParentID" ||
            key === "Tools" ||
            key === "Operations"
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
                className="rounded-md bg-white text-black p-1 border-b-2 border-black"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
