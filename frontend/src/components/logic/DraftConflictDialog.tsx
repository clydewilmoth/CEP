import { useContext } from "@/store";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GetChangesSince,
  GetEntityDetails,
} from "../../../wailsjs/go/main/Core";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";

export function DraftConflictDialog() {
  const { t } = useTranslation();
  const [draftConflicts, setDraftConflicts] = useState<Record<string, string>>(
    {}
  );
  const [open, setOpen] = useState(false);
  const { lastUpdate, setLastUpdate } = useContext();

  useEffect(() => {
    (async () => {
      const { deletedEntities, updatedEntities, newGlobalLastUpdatedAt } =
        await GetChangesSince(lastUpdate ?? "");

      if (newGlobalLastUpdatedAt != lastUpdate) {
        localStorage.setItem("lastUpdate", newGlobalLastUpdatedAt);
        setLastUpdate(newGlobalLastUpdatedAt);
        let conflictCounter = 1;
        let conflicts: Record<string, string> = {};

        Object.entries(deletedEntities).forEach(([, ids]) => {
          ids.forEach((id) => {
            if (localStorage.getItem(`${id}`)) {
              localStorage.removeItem(`${id}`);
            }
          });
        });
        for (const [entityType, entities] of Object.entries(updatedEntities)) {
          for (const entity of entities) {
            if (
              JSON.parse(localStorage.getItem(`${entity.id}`) ?? "{}") != "{}"
            ) {
              const localEntity = JSON.parse(
                localStorage.getItem(`${entity.id}`) ?? "{}"
              );
              const {
                Name: dbName,
                ToolClass,
                Template,
              } = await GetEntityDetails(entityType, entity.id);
              const Name = /*localEntity.Name ??*/ dbName;
              Object.entries(entity.changedFields || {}).forEach(
                ([field, value]) => {
                  if (localEntity[field]) {
                    conflicts[
                      `${conflictCounter}<|||>${t(entityType)} ${
                        Name ?? t("unnamed")
                      }`
                    ] = `${t(field)}<|||>${
                      field == "StatusColor"
                        ? t(String(value))
                        : field == "StationType"
                        ? t("ST_" + String(value) + "_Name")
                        : field == "ToolClass"
                        ? t("TC_" + String(value) + "_ToolClassName")
                        : field == "ToolType"
                        ? t(
                            "TT_" +
                              String(value) +
                              "_" +
                              String(ToolClass) +
                              "_Description"
                          )
                        : field == "SerialOrParallel"
                        ? t("SOP_" + String(value) + "_name")
                        : field == "AlwaysPerform"
                        ? t(String(value))
                        : field == "QGateRelevant"
                        ? t("QR_" + String(value) + "_name")
                        : field == "Template"
                        ? t("T_" + String(value) + "_Description")
                        : field == "DecisionClass"
                        ? t(
                            "OC_DECISION_" + String(value) + "_ClassDescription"
                          )
                        : field == "VerificationClass"
                        ? t(
                            "OC_VERIFICATION_" +
                              String(value) +
                              "_" +
                              String(Template) +
                              "_ClassDescription"
                          )
                        : field == "GenerationClass"
                        ? t(
                            "OC_GENERATION_" +
                              String(value) +
                              "_" +
                              String(Template) +
                              "_ClassDescription"
                          )
                        : field == "SavingClass"
                        ? t(
                            "OC_SAVING_" +
                              String(value) +
                              "_" +
                              String(Template) +
                              "_ClassDescription"
                          )
                        : field == "DecisionCriteria"
                        ? String(value).split("<|||>").join("; ")
                        : value
                    }`;

                    conflictCounter++;
                  }
                }
              );
            }
          }
        }
        setDraftConflicts(conflicts);
        setOpen(Object.keys(conflicts).length > 0);
      }
    })();
  }, []);

  let prevKey = "";

  return (
    <>
      {Object.keys(draftConflicts).length !== 0 && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent className="p-0 w-1/2">
            <ScrollArea className="max-h-[90vh]">
              <div className="p-6 py-9 flex flex-col gap-5">
                <AlertDialogTitle className="font-bold">
                  {t("DraftConflicts Title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("DraftConflicts Description")}
                </AlertDialogDescription>{" "}
                <div className="pb-5 flex flex-col gap-2">
                  {Object.entries(draftConflicts).map(([key, value]) => {
                    const keyWithoutCounter = key.split("<|||>")[1];
                    const showKey = keyWithoutCounter != prevKey;

                    if (showKey) {
                      prevKey = keyWithoutCounter;
                    }
                    return (
                      <>
                        {showKey && (
                          <div
                            key={key}
                            className="font-semibold mt-4"
                          >{`${keyWithoutCounter}`}</div>
                        )}
                        <div key={key + value} className="text-sm">
                          {`${value.split("<|||>")[0]} → ${
                            value.split("<|||>")[1]
                          }`}
                        </div>
                      </>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  type="submit"
                  className="w-1/3 mx-auto"
                  onClick={() => setOpen(false)}
                >
                  {t("Understood")}
                </Button>
              </div>
            </ScrollArea>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
