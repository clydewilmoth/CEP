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
              const { Name: dbName } = await GetEntityDetails(
                entityType,
                entity.id
              );
              const Name = localEntity.Name ?? dbName;
              Object.entries(entity.changedFields || {}).forEach(
                ([field, value]) => {
                  if (localEntity[field]) {
                    conflicts[
                      `${conflictCounter}<><><><><><><><><><><><><><><><><><><><><>${t(
                        entityType
                      )} ${Name}`
                    ] = `${t(
                      field
                    )}<><><><><><><><><><><><><><><><><><><><><>${value}`;

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
          <AlertDialogContent>
            <AlertDialogTitle className="font-bold">
              {t("DraftConflicts Title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("DraftConflicts Description")}
            </AlertDialogDescription>{" "}
            <div className="py-3 flex flex-col gap-2">
              {Object.entries(draftConflicts).map(([key, value]) => {
                const keyWithoutCounter = key.split(
                  "<><><><><><><><><><><><><><><><><><><><><>"
                )[1];
                const showKey = keyWithoutCounter != prevKey;

                if (showKey) {
                  prevKey = keyWithoutCounter;
                }
                return (
                  <>
                    {showKey && (
                      <div
                        key={key}
                        className="font-bold"
                      >{`${keyWithoutCounter}: `}</div>
                    )}
                    <div key={key + value} className="text-sm">
                      {`${t(
                        value.split(
                          "<><><><><><><><><><><><><><><><><><><><><>"
                        )[0]
                      )}: ${t(
                        value.split(
                          "<><><><><><><><><><><><><><><><><><><><><>"
                        )[1]
                      )}`}
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
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
