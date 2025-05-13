import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Globe } from "lucide-react";

import { useTranslation } from "react-i18next";

export default function InernalisationDropwdown() {
  const [language, setLanguage] = React.useState(
    String(localStorage.getItem("language")) == "null"
      ? "en"
      : String(localStorage.getItem("language"))
  );
  const { t, i18n } = useTranslation();
  React.useEffect(() => {
    i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  }, [language]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="rounded-lg bg-black text-white p-1 w-8 h-8">
          <Globe />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-fit bg-black text-white">
        <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
        <DropdownMenuSeparator className="w-3/4 mx-auto" />
        <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="de">Deutsch</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/*
import { useTranslation } from "react-i18next";

const { t, i18n } = useTranslation();

onChange={(e) => {
    i18n.changeLanguage(e.target.value);
  }}
    */
