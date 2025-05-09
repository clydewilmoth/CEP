import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

export default function LanguageForm() {
  const { t, i18n } = useTranslation();

  return (
    <>
      <h1>Demo Internalisation Function</h1>
      <h1>
        {t("Mythical")}

        <Button
          className="ml-5"
          onClick={() => {
            i18n.changeLanguage(i18n.language === "de" ? "en" : "de");
          }}
        >
          Change Language
        </Button>
      </h1>
    </>
  );
}
