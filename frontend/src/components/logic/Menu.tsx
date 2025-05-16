import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu as Burger, Globe, User } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { GetPlatformSpecificUserName } from "../../../wailsjs/go/main/Core";
import { DialogHeader } from "../ui/dialog";
import { Input } from "../ui/input";

export function Menu() {
  const { i18n } = useTranslation();
  useEffect(() => {
    localStorage.getItem("lang") == null
      ? i18n.changeLanguage("en")
      : i18n.changeLanguage(String(localStorage.getItem("lang")));
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Burger />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-6">
        <UserDialog />
        <DropdownMenuSeparator />
        <LangDialog />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
        <Button variant="ghost" size="icon">
          <User />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>{t("NameDialog Title")}</DialogTitle>
          <DialogDescription>{t("NameDialog Description")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 items-center gap-4">
          <Input
            id="name"
            value={String(name)}
            className="col-span-4"
            onChange={(e) => (
              setName(e.target.value),
              localStorage.setItem("name", e.target.value)
            )}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LangDialog() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState<string | null>();
  useEffect(() => {
    setLang(localStorage.getItem("lang"));
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Globe />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>{t("LangDialog Title")}</DialogTitle>
          <DialogDescription>{t("LangDialog Description")}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={String(lang)}
          onValueChange={(e) => (
            setLang(e), i18n.changeLanguage(e), localStorage.setItem("lang", e)
          )}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="en" id="r1" />
            <Label htmlFor="r1">English</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="de" id="r2" />
            <Label htmlFor="r2">Deutsch</Label>
          </div>
        </RadioGroup>
      </DialogContent>
    </Dialog>
  );
}
