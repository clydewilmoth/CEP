import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { User } from "lucide-react";
import { GetPlatformSpecificUserName } from "../../../wailsjs/go/main/Core";
import { useEffect, useState } from "react";

export function UserDialog() {
  const { t } = useTranslation();
  const [name, setName] = useState<string | null>();
  useEffect(() => {
    async function fetchAndSetName() {
      setName(await GetPlatformSpecificUserName());
    }
    localStorage.getItem("name") == null
      ? fetchAndSetName()
      : setName(localStorage.getItem("name"));
  }, []);

  return (
    <Dialog
      onOpenChange={async () => {
        name == "" &&
          (setName(await GetPlatformSpecificUserName()),
          localStorage.setItem("name", await GetPlatformSpecificUserName()));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <User />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>{t("Name")}</DialogTitle>
          <DialogDescription>
            {t(
              "Edit name. Changes save automatically. Close the window to finish."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 items-center gap-4">
          <Input
            id="name"
            value={String(name)}
            className="col-span-4"
            onChange={async (e) => (
              setName(e.target.value),
              localStorage.setItem("name", e.target.value)
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
