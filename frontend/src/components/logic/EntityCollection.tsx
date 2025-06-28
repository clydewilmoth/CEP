import { Card, CardTitle } from "@/components/ui/card";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  GetAllEntities,
  CreateEntity,
  DeleteEntityByIDString,
  HandleExport,
  HandleImport,
  CopyEntityHierarchyToClipboard,
  PasteEntityHierarchyFromClipboard as PasteEntityHierarchyFromClipboardAPI,
  UpdateEntityFieldsString,
} from "../../../wailsjs/go/main/Core";
import {
  Ellipsis,
  FileDown,
  FileUp,
  ClipboardCopy,
  ClipboardPaste,
  Funnel,
  Plus,
  SearchIcon,
  SquarePen,
  Trash2,
  X,
  XIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  SearchField,
  SearchFieldClear,
  SearchFieldInput,
} from "../ui/searchfield";
import { FieldGroup } from "../ui/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import { max50Crop, StringNullToBlank } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { useDelayedLoading } from "@/lib/hooks";
import { useContext } from "@/store";

export function EntityCollection({
  entityType,
  parentId,
  link,
}: {
  entityType: string;
  parentId: string;
  link: string;
}) {
  const { data: entities, isFetching } = useQuery({
    queryKey: ["entities", entityType, parentId],
    queryFn: async () => {
      return await GetAllEntities(entityType, String(parentId));
    },
  });
  const { t } = useTranslation();
  const [searchFilter, setSeachFilter] = useState("");
  const [filter, setFilter] = useState("none");
  const [key, setKey] = useState(0);

  // Use delayed loading to prevent skeleton flickering
  const showSkeletons = useDelayedLoading(isFetching);

  return (
    <div className="flex flex-col gap-7 w-full">
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-bold">{t(`${entityType}s`)}</h1>
        <div className="flex gap-5 items-center">
          <SearchField
            className="max-w-72 rounded-3xl"
            aria-labelledby="search-field"
          >
            <FieldGroup>
              <SearchIcon
                aria-hidden
                className="size-4 text-muted-foreground"
              />
              <SearchFieldInput
                placeholder={t("Search for Name")}
                value={searchFilter}
                onChange={(e) => setSeachFilter(e.target.value)}
                className="outline-none shadow-none"
              />
              <SearchFieldClear>
                <XIcon
                  aria-hidden
                  className="size-4"
                  onClick={() => setSeachFilter("")}
                />
              </SearchFieldClear>
            </FieldGroup>
          </SearchField>
          <Select onValueChange={(value) => setFilter(value)}>
            <SelectTrigger className="w-fit bg-card h-10">
              <SelectValue placeholder={<Funnel size={14} />} />
            </SelectTrigger>
            <SelectContent className="min-w-0 w-fit">
              <SelectItem value="none">
                <div className="flex gap-3 items-center">
                  <X size={14} className="opacity-80" />
                  <p>{t("NoFilter")}</p>
                </div>
              </SelectItem>
              <SelectItem value="red">
                <div className="flex gap-3 items-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 6 6"
                    fill="rgb(239, 68, 68)"
                    xmlns="http://www.w3.org/2000/svg"
                    className="border rounded-full"
                  >
                    <circle cx="3" cy="3" r="3" />
                  </svg>
                  <p>{t("Pending")}</p>
                </div>
              </SelectItem>
              <SelectItem value="amber">
                <div className="flex gap-3 items-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 6 6"
                    fill="rgb(245, 158, 11)"
                    xmlns="http://www.w3.org/2000/svg"
                    className="border rounded-full"
                  >
                    <circle cx="3" cy="3" r="3" />
                  </svg>
                  <p>{t("InProgress")}</p>
                </div>
              </SelectItem>
              <SelectItem value="emerald">
                <div className="flex gap-3 items-center">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 6 6"
                    fill="rgb(16, 185, 129)"
                    xmlns="http://www.w3.org/2000/svg"
                    className="border rounded-full"
                  >
                    <circle cx="3" cy="3" r="3" />
                  </svg>
                  <p>{t("Ready")}</p>
                </div>
              </SelectItem>
              <SelectItem value="draft">
                <div className="flex gap-3 items-center">
                  <SquarePen size={14} className="opacity-80" />
                  <p>{t("Draft")}</p>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu key={key}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="text-muted-foreground"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <CreateEntityButton
                entityType={entityType}
                parentId={parentId}
                link={link}
              />
              <DropdownMenuSeparator className="bg-accent" />
              <PasteEntityHierarchyFromClipboard
                entityType={entityType}
                parentId={parentId}
                onClick={() => setKey((k) => k + 1)}
              />
              {entityType == "line" && (
                <>
                  <DropdownMenuSeparator className="bg-accent" />
                  <ImportJSON onClick={() => setKey((k) => k + 1)} />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {showSkeletons ? (
        <div className="flex flex-wrap gap-7">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <ScrollArea className="h-[78vh] pr-5">
          {!entities && (
            <div className="text-sm font-semibold max-w-[23rem] max-h-fit bg-card border p-4 flex flex-col gap-3 rounded-lg">
              {t("NoEntityAvailable", { entityType: t(`${entityType}s`) })}
            </div>
          )}
          <div
            className={
              entityType == "line"
                ? "grid gap-7 xl:grid-cols-4 lg:grid-cols-3"
                : "grid gap-7 xl:grid-cols-3 lg:grid-cols-2"
            }
          >
            {entities?.map((entity, index) => {
              let filterCondition = true;
              switch (filter) {
                case "none":
                  filterCondition = true;
                  break;
                case "red":
                  filterCondition = entity.StatusColor == "red";
                  break;
                case "amber":
                  filterCondition = entity.StatusColor == "amber";
                  break;
                case "emerald":
                  filterCondition = entity.StatusColor == "emerald";
                  break;
                case "draft":
                  filterCondition = Boolean(localStorage.getItem(entity.ID));
                  break;
                default:
                  filterCondition = true;
              }
              return (
                StringNullToBlank(entity.Name).includes(searchFilter) &&
                filterCondition && (
                  <EntityCard
                    entityType={entityType}
                    entityId={entity.ID}
                    entityName={entity.Name}
                    entityComment={entity.Comment}
                    entityStatusColor={
                      entity.StatusColor != "empty" ? entity.StatusColor : null
                    }
                    link={link}
                    key={index}
                  />
                )
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function CreateEntityButton({
  entityType,
  parentId,
  link,
}: {
  entityType: string;
  parentId: string;
  link: string;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutateAsync: createEntity } = useMutation({
    mutationFn: ({
      name,
      entityType,
      parentId,
    }: {
      name: string;
      entityType: string;
      parentId: string;
    }) => {
      return CreateEntity(name, entityType, parentId);
    },
    onSuccess: (res) => (
      queryClient.invalidateQueries(),
      toast.success(`${t(entityType)} ${t("CreateToast")}`),
      navigate(`${link}${res.ID}`)
    ),
  });

  const [, navigate] = useLocation();

  return (
    <div className="flex gap-1 items-center">
      <Button
        className="w-full justify-start flex items-center gap-2 px-3 py-2"
        variant="ghost"
        onClick={async () =>
          await createEntity({
            name: String(localStorage.getItem("name")),
            entityType: entityType,
            parentId: parentId,
          })
        }
      >
        <Plus />
        <span className="text-sm ">{t("CreateEntity")}</span>
      </Button>
    </div>
  );
}

function EntityCard({
  entityType,
  entityId,
  entityName,
  entityComment,
  entityStatusColor,
  link,
}: {
  entityType: string;
  entityId: string;
  entityName: string;
  entityComment: string;
  entityStatusColor?: string;
  link: string;
}) {
  const [key, setKey] = useState(0);
  const [, navigate] = useLocation();
  const [red, setRed] = useState(0);
  const [amber, setAmber] = useState(0);
  const [emerald, setEmerald] = useState(0);
  const { dbState } = useContext();

  useEffect(() => {
    (async () => {
      setRed(0);
      setAmber(0);
      setEmerald(0);
      if (entityType == "tool") {
        const operations = await GetAllEntities("operation", entityId);
        operations?.forEach((operation) => {
          operation.StatusColor == "red"
            ? setRed((prev) => prev + 1)
            : operation.StatusColor == "amber"
            ? setAmber((prev) => prev + 1)
            : operation.StatusColor == "emerald" &&
              setEmerald((prev) => prev + 1);
        });
      } else if (entityType == "station") {
        const tools = await GetAllEntities("tool", entityId);
        tools?.forEach(async (tool) => {
          tool.StatusColor == "red"
            ? setRed((prev) => prev + 1)
            : tool.StatusColor == "amber"
            ? setAmber((prev) => prev + 1)
            : tool.StatusColor == "emerald" && setEmerald((prev) => prev + 1);

          const operations = await GetAllEntities("operation", tool.ID);
          operations?.forEach((operation) => {
            operation.StatusColor == "red"
              ? setRed((prev) => prev + 1)
              : operation.StatusColor == "amber"
              ? setAmber((prev) => prev + 1)
              : operation.StatusColor == "emerald" &&
                setEmerald((prev) => prev + 1);
          });
        });
      } else if (entityType == "line") {
        const stations = await GetAllEntities("station", entityId);
        stations?.forEach(async (station) => {
          station.StatusColor == "red"
            ? setRed((prev) => prev + 1)
            : station.StatusColor == "amber"
            ? setAmber((prev) => prev + 1)
            : station.StatusColor == "emerald" &&
              setEmerald((prev) => prev + 1);

          const tools = await GetAllEntities("tool", station.ID);
          tools?.forEach(async (tool) => {
            tool.StatusColor == "red"
              ? setRed((prev) => prev + 1)
              : tool.StatusColor == "amber"
              ? setAmber((prev) => prev + 1)
              : tool.StatusColor == "emerald" && setEmerald((prev) => prev + 1);

            const operations = await GetAllEntities("operation", tool.ID);
            operations?.forEach((operation) => {
              operation.StatusColor == "red"
                ? setRed((prev) => prev + 1)
                : operation.StatusColor == "amber"
                ? setAmber((prev) => prev + 1)
                : operation.StatusColor == "emerald" &&
                  setEmerald((prev) => prev + 1);
            });
          });
        });
      }
    })();
  }, [dbState]);

  return (
    <Card
      onClick={() => {
        link != "" && navigate(`${link}${entityId}`);
      }}
      className="h-fit relative hover:cursor-pointer hover:translate-y-1 transition-all flex-col gap-3 py-6 px-4"
    >
      <div className="flex justify-between border-b h-1/2 w-full items-center px-2">
        <CardTitle className="break-words max-w-24 text-center">
          {entityName}
        </CardTitle>
        <div className="flex">
          {entityStatusColor && (
            <Button
              variant="ghost"
              size="icon"
              disabled
              className="disabled:opacity-100"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 6 6"
                fill={
                  entityStatusColor == "red"
                    ? "rgb(239, 68, 68)"
                    : entityStatusColor == "amber"
                    ? "rgb(245, 158, 11)"
                    : "rgb(16, 185, 129)"
                }
                xmlns="http://www.w3.org/2000/svg"
                className="border rounded-full"
              >
                <circle cx="3" cy="3" r="3" />
              </svg>
            </Button>
          )}
          {localStorage.getItem(entityId) && (
            <Button
              variant="ghost"
              size="icon"
              disabled
              className="disabled:opacity-80"
            >
              <SquarePen size={15} />
            </Button>
          )}
          <DropdownMenu key={key}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
              <DeleteEntityDialog
                entityType={entityType}
                entityId={entityId}
                onClose={() => setKey((k) => k + 1)}
              />
              <DropdownMenuSeparator className="bg-accent" />
              <ClipboardExportButton
                entityType={entityType}
                entityId={entityId}
                onClick={() => setKey((k) => k + 1)}
              />
              {entityType == "line" && (
                <>
                  <DropdownMenuSeparator className="bg-accent" />
                  <ExportJSON
                    entityType={entityType}
                    entityId={entityId}
                    onClick={() => setKey((k) => k + 1)}
                  />
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex justify-between h-1/2 w-full px-2 py-2">
        <div className="w-1/2 break-words text-sm pr-1 text-muted-foreground">
          {max50Crop(entityComment ? entityComment : "")}
        </div>
        <div className="flex gap-3 items-start text-sm text-muted-foreground">
          <div className="flex gap-2 items-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 6 6"
              fill="rgb(239, 68, 68)"
              xmlns="http://www.w3.org/2000/svg"
              className="border rounded-full"
            >
              <circle cx="3" cy="3" r="3" />
            </svg>
            <div>{red}</div>
          </div>
          <div className="flex gap-2 items-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 6 6"
              fill="rgb(245, 158, 11)"
              xmlns="http://www.w3.org/2000/svg"
              className="border rounded-full"
            >
              <circle cx="3" cy="3" r="3" />
            </svg>
            <div>{amber}</div>
          </div>
          <div className="flex gap-2 items-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 6 6"
              fill="rgb(16, 185, 129)"
              xmlns="http://www.w3.org/2000/svg"
              className="border rounded-full"
            >
              <circle cx="3" cy="3" r="3" />
            </svg>
            <div>{emerald}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DeleteEntityDialog({
  entityType,
  entityId,
  onClose,
}: {
  entityType: string;
  entityId: string;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { mutateAsync: deleteEntity } = useMutation({
    mutationFn: ({
      name,
      entityType,
      entityId,
    }: {
      name: string;
      entityType: string;
      entityId: string;
    }) => DeleteEntityByIDString(name, entityType, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success(`${t(entityType)} ${t("DeleteToast")}`);
    },
  });

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      // Wait for the operations to be updated first
      await deleteOperationSequenceAttributes(entityType, entityId);

      // Then delete the entity
      await deleteEntity({
        name: String(localStorage.getItem("name")),
        entityType: entityType,
        entityId: entityId,
      });

      setOpen(false);
      if (onClose) onClose();
    } catch (error) {
      console.error("Error during deletion:", error);
      toast.error("Failed to delete entity");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        setOpen(open);
        if (!open && onClose) onClose();
      }}
    >
      <div className="flex gap-1 items-center">
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start flex items-center gap-2 px-3 py-2"
          >
            <Trash2 />
            <span className="text-sm ">{t("DeleteEntity")}</span>
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent className="py-10 grid grid-cols-1 gap-5 w-80">
        <DialogTitle>{t("DeleteDialog Title")}</DialogTitle>
        <DialogDescription>
          {t("DeleteDialog Description", { Entity: t(entityType) })}
        </DialogDescription>
        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-1/2 mx-auto"
        >
          {isDeleting ? "..." : t("Confirm")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ExportJSON({
  entityType,
  entityId,
  onClick,
}: {
  entityType: string;
  entityId: string;
  onClick?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-1 items-center">
      <Button
        variant="ghost"
        className="w-full justify-start flex items-center gap-2 px-3 py-2"
        onClick={async () => {
          const res = await HandleExport(entityType, entityId);
          res == "ExportSuccess" ? toast.success(t(res)) : toast.error(t(res));
          onClick && onClick();
        }}
      >
        <FileUp />
        <span className="text-sm ">{t("ExportJSON")}</span>
      </Button>
    </div>
  );
}

async function deleteOperationSequenceAttributes(
  entityType: string,
  entityId: string
) {
  if (entityType == "sequencegroup") {
    try {
      const operationsToUpdate =
        (await GetAllEntities("operation", entityId)) || [];
      if (operationsToUpdate && operationsToUpdate.length > 0) {
        for (const operation of operationsToUpdate) {
          console.log(
            `Updating operation ${operation.ID} to remove group link...`
          );

          await UpdateEntityFieldsString(
            localStorage.getItem("name") || "",
            "operation",
            operation.ID,
            operation.UpdatedAt,
            {
              GroupID: "",
              Sequence: "",
              SequenceGroup: "",
            }
          );

          console.log(`...Update for ${operation.ID} complete.`);
        }
      }
    } catch (error) {
      console.error(
        "Error updating child operations before deleting group:",
        error
      );
      throw error;
    }
  }
}

function ClipboardExportButton({
  entityType,
  entityId,
  onClick,
}: {
  entityType: string;
  entityId: string;
  onClick?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-1 items-center">
      <Button
        variant="ghost"
        className="w-full justify-start flex items-center gap-2 px-3 py-2"
        onClick={async () => {
          try {
            await CopyEntityHierarchyToClipboard(entityType, entityId);
            toast.success(t("CopiedToClipboard"));
            onClick?.();
          } catch (err) {
            console.error(err);
            toast.error(t("ClipboardCopyFailed"));
          }
        }}
      >
        <ClipboardCopy className="w-4 h-4" />
        <span className="text-sm ">{t("CopyToClipboard")}</span>
      </Button>
    </div>
  );
}

function ImportJSON({ onClick }: { onClick?: () => void }) {
  const queryClient = useQueryClient();

  const { mutateAsync: importEntity } = useMutation({
    mutationFn: async () => {
      const res = await HandleImport(localStorage.getItem("name") ?? "");
      res == "ImportSuccess" ? toast.success(t(res)) : toast.error(t(res));
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const { t } = useTranslation();

  return (
    <div className="flex gap-1 items-center">
      <Button
        variant="ghost"
        className="w-full justify-start flex items-center gap-2 px-3 py-2"
        onClick={() => (importEntity(), onClick && onClick())}
      >
        <FileDown />
        <span className="text-sm ">{t("ImportJSON")}</span>
      </Button>
    </div>
  );
}

function PasteEntityHierarchyFromClipboard({
  entityType,
  parentId,
  onClick,
}: {
  entityType: string;
  parentId: string;
  onClick?: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutateAsync: pasteEntity } = useMutation({
    mutationFn: async () => {
      return await PasteEntityHierarchyFromClipboardAPI(
        String(localStorage.getItem("name")),
        entityType,
        parentId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success(t("PasteFromClipboardSuccess"));
    },
    onError: () => toast.error(t("PasteFromClipboardError")),
  });

  return (
    <div className="flex gap-1 items-center">
      <Button
        variant="ghost"
        className="w-full justify-start flex items-center gap-2 px-3 py-2"
        onClick={() => {
          pasteEntity();
          onClick?.();
        }}
      >
        <ClipboardPaste />
        <span className="text-sm ">{t("PasteFromClipboard")}</span>
      </Button>
    </div>
  );
}
