import { useState } from "react";
import { UpdateEntityFieldsString } from "../../../wailsjs/go/main/Core";
import { X } from "lucide-react";
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
      <div className="flex flex-col justify-center items-center p-10 gap-3 bg-black text-white rounded-xl fixed left-1/2 translate-x-[-50%]">
        <Button
          className="rounded-lg bg-white text-black p-1 hover:bg-slate-100 w-8 h-8 focus:bg-slate-100"
          onClick={onClose}
        >
          <X />
        </Button>

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
                className="rounded-lg bg-white text-black p-1"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
