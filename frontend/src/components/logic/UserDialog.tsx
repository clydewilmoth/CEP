import { Undo2 } from "lucide-react";
import { Button } from "../ui/button";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function UserDialog() {
  const [formMode, setFormMode] = useState(false);
  const [user, setUser] = useState<string | null>("");
  useEffect(() => {
    localStorage.getItem("user") == null
      ? setFormMode(true)
      : setUser(localStorage.getItem("user"));
  }, []);
  const [alert, setAlert] = useState("");
  const { t, i18n } = useTranslation();

  return (
    <>
      {formMode ? (
        <div className="fixed left-0 right-0 top-0 bg-white flex justify-center z-50 h-screen">
          <div className="flex flex-col justify-center items-center p-10 gap-5 bg-white text-black shadow-xl border-2 rounded-lg h-fit mt-10 ">
            <Button
              className="rounded-lg bg-black text-white p-1 w-8 h-8"
              onClick={() => {
                if (user == "") {
                  setAlert(t("userAlert"));
                } else {
                  setFormMode(false);
                  setAlert("");
                }
              }}
            >
              <Undo2 />
            </Button>
            <h1 className="w-full text-center font-semibold text-base">
              {t("user")}
            </h1>
            <input
              type="text"
              value={String(user)}
              onChange={(e) => {
                setUser(e.target.value);
                localStorage.setItem("user", e.target.value); // Fix: Speichere das neue Value, nicht den alten user-State
                e.target.value === "" ? setAlert(t("userAlert")) : setAlert("");
              }}
              className="rounded-md bg-white text-black p-1 border-b-2 border-black w-full"
            />
            <h1>{alert}</h1>
          </div>
        </div>
      ) : (
        <Button
          className="rounded-lg bg-black text-white p-1 w-8 h-8"
          onClick={() => setFormMode(true)}
        >
          <User />
        </Button>
      )}
    </>
  );
}
