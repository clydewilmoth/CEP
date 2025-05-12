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
    <div className="relative w-fit flex flex-col justify-center items-center">
      <div className="flex w-[28.2rem] flex-wrap justify-start items-center bg-white text-black shadow-xl border-2 rounded-xl p-6 max-h-[32rem] overflow-auto gap-5">
        <div className="flex justify-center w-full">
          <Button
            className="rounded-lg bg-black text-white p-1 w-8 h-8"
            onClick={onClose}
          >
            <Undo2 />
          </Button>
        </div>
        {Object.entries(fields).map(([key, value]) => {
          if (
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
            <div key={key} className="w-fit">
              <h1 className="text-base font-medium mb-1 text-center">{key}</h1>
              <input
                type="text"
                value={inputValue}
                onChange={async (e) => {
                  setInputValue(e.target.value);
                  await UpdateEntityFieldsString(
                    String(localStorage.getItem("user")),
                    entity,
                    entityID,
                    {
                      [key]: e.target.value,
                    }
                  );
                }}
                className="rounded-md bg-white text-black p-1 border-b-2 border-black w-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
