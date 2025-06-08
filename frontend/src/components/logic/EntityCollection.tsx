import { Card, CardTitle } from "@/components/ui/card";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  GetAllEntities,
  CreateEntity,
  DeleteEntityByIDString,
  HandleExport,
  HandleImport,
  CopyEntityHierarchyToClipboard,
  PasteEntityHierarchyFromClipboard as PasteEntityHierarchyFromClipboardAPI,
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
import { useState } from "react";
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

export function EntityCollection({
  entityType,
  parentId,
  link,
}: {
  entityType: string;
  parentId: string;
  link: string;
}) {
  const { data: entities } = useQuery({
    queryKey: ["entities", entityType, parentId],
    queryFn: async () => await GetAllEntities(entityType, String(parentId)),
  });
  const { t } = useTranslation();
  const [searchFilter, setSeachFilter] = useState("");
  const [filter, setFilter] = useState("none");

  return (
    <div className="flex flex-col gap-7 w-full">
      <div className="flex gap-5 items-center">
        <SearchField
          className="max-w-72 rounded-3xl"
          aria-labelledby="search-field"
        >
          <FieldGroup>
            <SearchIcon aria-hidden className="size-4 text-muted-foreground" />
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
      </div>
      <div className="flex flex-wrap gap-7">
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
        <CreateEntityCard
          entityType={entityType}
          parentId={parentId}
          link={link}
        />
      </div>
    </div>
  );
}

function CreateEntityCard({
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

  const [key, setKey] = useState(0);
  const [, navigate] = useLocation();

  return (
    <Card
      className="w-36 h-fit flex relative justify-center items-center hover:cursor-pointer hover:translate-y-1 transition-all"
      onClick={async () =>
        await createEntity({
          name: String(localStorage.getItem("name")),
          entityType: entityType,
          parentId: parentId,
        })
      }
    >
      <div className="absolute top-0 left-0">
        <DropdownMenu key={key}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
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
      <Button variant="ghost" size="icon" className="hover:bg-card">
        <Plus />
      </Button>
    </Card>
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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card
            onClick={() => {
              link != "" && navigate(`${link}${entityId}`);
            }}
            className="relative w-36 hover:cursor-pointer hover:translate-y-1 transition-all h-fit flex gap-3 justify-center items-center py-4"
          >
            <div className="absolute top-0 left-0">
              <DropdownMenu key={key}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
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
            {(localStorage.getItem(entityId) || entityStatusColor) && (
              <div className="flex flex-col items-center absolute top-0 right-0">
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
              </div>
            )}
            {entityName && (
              <CardTitle className="break-words max-w-24 text-center">
                {entityName}
              </CardTitle>
            )}
          </Card>
        </TooltipTrigger>

        {typeof entityComment == "string" && entityComment != "" && (
          <TooltipContent>{entityComment}</TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function DeleteEntityDialog({
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
    onSuccess: () => (
      queryClient.invalidateQueries(),
      toast.success(`${t(entityType)} ${t("DeleteToast")}`)
    ),
  });

  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (setOpen(open), !open && onClose && onClose())}
    >
      <div className="flex gap-1 items-center">
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start flex items-center gap-2 px-3 py-2"
          >
            <Trash2 />
            <span className="text-sm font-semibold">{t("DeleteEntity")}</span>
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
          onClick={() => (
            deleteEntity({
              name: String(localStorage.getItem("name")),
              entityType: entityType,
              entityId: entityId,
            }),
            setOpen(false),
            onClose && onClose()
          )}
          className="w-1/2 mx-auto"
        >
          {t("Confirm")}
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
        <span className="text-sm font-semibold">{t("ExportJSON")}</span>
      </Button>
    </div>
  );
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
        <span className="text-sm font-semibold">{t("CopyToClipboard")}</span>
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
        <span className="text-sm font-semibold">{t("ImportJSON")}</span>
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
        <span className="text-sm font-semibold">{t("PasteFromClipboard")}</span>
      </Button>
    </div>
  );
}

export function StringNullToBlank(value: string) {
  return value ? String(value) : "";
}
