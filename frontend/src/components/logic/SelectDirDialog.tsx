import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { FolderOpen, Undo2 } from "lucide-react";
import { SelectDir } from "../../../wailsjs/go/main/Core";

export default function SelectDirDialog() {
  const [formMode, setFormMode] = useState(false);
  const [versionPath, setVersionPath] = useState<string | null>("");
  useEffect(() => {
    localStorage.getItem("versionPath") == null
      ? setFormMode(true)
      : setVersionPath(localStorage.getItem("versionPath"));
  }, []);
  const [alert, setAlert] = useState("");

  return (
    <>
      {formMode ? (
        <div className="fixed left-0 right-0 top-0 bg-white flex justify-center z-50 h-screen">
          <div className="flex flex-col justify-center items-center p-10 gap-5 bg-white text-black shadow-xl border-2 rounded-lg h-fit mt-10 ">
            <Button
              className="rounded-lg bg-black text-white p-1 w-8 h-8"
              onClick={() => {
                if (versionPath == "") {
                  setAlert("Path required!");
                } else {
                  setFormMode(false);
                  setAlert("");
                }
              }}
            >
              <Undo2 />
            </Button>
            <h1 className="w-full text-center font-semibold text-base">
              Version DB Path
            </h1>
            <input
              type="text"
              value={String(versionPath)}
              onChange={(e) => {
                setVersionPath(e.target.value);
                localStorage.setItem("versionPath", e.target.value);
                e.target.value === ""
                  ? setAlert("Path required!")
                  : setAlert("");
              }}
              className="rounded-md bg-white text-black p-1 border-b-2 border-black w-full"
              disabled
            />
            <h1>{alert}</h1>
            <Button
              className="rounded-lg bg-black text-white p-1 w-8 h-8"
              onClick={async () => {
                localStorage.setItem("versionPath", await SelectDir());
                setVersionPath(localStorage.getItem("versionPath"));
                versionPath != "" && setAlert("");
              }}
            >
              <FolderOpen />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="rounded-lg bg-black text-white p-1 w-8 h-8"
          onClick={() => setFormMode(true)}
        >
          <FolderOpen />
        </Button>
      )}
    </>
  );
}
