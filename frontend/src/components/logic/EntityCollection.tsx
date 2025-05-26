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
} from "../../../wailsjs/go/main/Core";
import {
  Eye,
  FileDown,
  FileUp,
  Plus,
  SearchIcon,
  SquarePen,
  Trash2,
  XIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { LineForm, OperationForm, StationForm, ToolForm } from "./EntityForms";
import { useInit } from "@/App";
import {
  SearchField,
  SearchFieldClear,
  SearchFieldInput,
} from "../ui/searchfield";
import { FieldGroup } from "../ui/field";
import { ScrollArea } from "../ui/scroll-area";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DialogDescription } from "@radix-ui/react-dialog";

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
    queryFn: () => GetAllEntities(entityType, String(parentId)),
  });
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [createdEntityId, setCreatedEntityId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-7 w-full">
      <SearchField
        className="max-w-sm rounded-3xl mx-auto shadow-muted-foreground"
        aria-labelledby="search-field"
      >
        <FieldGroup>
          <SearchIcon aria-hidden className="size-4 text-muted-foreground" />
          <SearchFieldInput
            placeholder={t("Search")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="outline-none shadow-none"
          />
          <SearchFieldClear>
            <XIcon
              aria-hidden
              className="size-4"
              onClick={() => setFilter("")}
            />
          </SearchFieldClear>
        </FieldGroup>
      </SearchField>

      <div className="flex flex-wrap gap-7">
        {entities?.map(
          (entity, index) =>
            StringNullToBlank(entity.Name).includes(filter) && (
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
        )}
        <CreateEntityCard
          entityType={entityType}
          parentId={parentId}
          onCreated={(id: string) => {
            setCreatedEntityId(id);
            setFormDialogOpen(true);
          }}
        />
      </div>
      {formDialogOpen && createdEntityId && (
        <FormDialog
          entityType={entityType}
          entityId={createdEntityId}
          onClose={() => setFormDialogOpen(false)}
          forceOpen={true}
        />
      )}
    </div>
  );
}

function CreateEntityCard({
  entityType,
  parentId,
  onCreated,
}: {
  entityType: string;
  parentId: string;
  onCreated: (id: string) => void;
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
      toast(`${t(entityType)} ${t("CreateToast")}`),
      onCreated && onCreated(res.ID)
    ),
  });

  const [key, setKey] = useState(0);

  return (
    <ContextMenu key={key}>
      <ContextMenuTrigger>
        <Card
          className="w-36 flex justify-center items-center hover:cursor-pointer hover:translate-y-1 transition-all"
          onClick={async () => {
            await createEntity({
              name: String(localStorage.getItem("name")),
              entityType: entityType,
              parentId: parentId,
            });
          }}
        >
          <Button variant="ghost" size="icon" className="hover:bg-background">
            <Plus />
          </Button>
        </Card>
      </ContextMenuTrigger>
      {entityType == "line" && (
        <ContextMenuContent className="min-w-0">
          <ImportJSON onClick={() => setKey((k) => k + 1)} />
        </ContextMenuContent>
      )}
    </ContextMenu>
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
  const [_, navigate] = useLocation();

  return (
    <ContextMenu key={key}>
      <ContextMenuTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                onClick={() => {
                  link != "" && navigate(`${link}${entityId}`);
                }}
                className="w-36 hover:cursor-pointer hover:translate-y-1 transition-all h-fit flex gap-3 justify-center items-center px-5 py-1"
              >
                {entityName && (
                  <CardTitle className="break-words max-w-24 text-center">
                    {entityName}
                  </CardTitle>
                )}
                {(localStorage.getItem(entityId) || entityStatusColor) && (
                  <div className="flex flex-col gap-3 justify-between items-center">
                    {localStorage.getItem(entityId) && <SquarePen size={15} />}
                    {entityStatusColor && (
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
                      >
                        <circle cx="3" cy="3" r="3" />
                      </svg>
                    )}
                  </div>
                )}
              </Card>
            </TooltipTrigger>
            {typeof entityComment == "string" && entityComment != "" && (
              <TooltipContent>{entityComment}</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-0">
        <FormDialog
          entityType={entityType}
          entityId={entityId}
          onClose={() => setKey((k) => k + 1)}
        />
        <ContextMenuSeparator />
        <DeleteEntityDialog
          entityType={entityType}
          entityId={entityId}
          onClose={() => setKey((k) => k + 1)}
        />

        {entityType == "line" && (
          <>
            <ContextMenuSeparator />
            <ExportJSON
              entityType={entityType}
              entityId={entityId}
              onClick={() => setKey((k) => k + 1)}
            />
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
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
      toast(`${t(entityType)} ${t("DeleteToast")}`)
    ),
    onError: () => {
      appRerender();
    },
  });

  const { appRerender } = useInit();
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (setOpen(open), !open && onClose && onClose())}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="py-10 grid grid-cols-1 gap-8 w-80">
        <DialogTitle>{t("DeleteDialog Title")}</DialogTitle>
        <DialogDescription>
          {`${t("DeleteDialog Description1")} ${t(entityType)}${t(
            "DeleteDialog Description2"
          )}`}
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
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => (
        toast(t(await HandleExport(entityType, entityId))), onClick && onClick()
      )}
    >
      <FileUp />
    </Button>
  );
}

function ImportJSON({ onClick }: { onClick?: () => void }) {
  const queryClient = useQueryClient();

  const { mutateAsync: importEntity } = useMutation({
    mutationFn: async () =>
      toast(t(await HandleImport(String(localStorage.getItem("name"))))),
    onSuccess: () => queryClient.invalidateQueries(),
  });
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => (importEntity(), onClick && onClick())}
    >
      <FileDown />
    </Button>
  );
}

function FormDialog({
  entityType,
  entityId,
  onClose,
  forceOpen = false,
}: {
  entityType: string;
  entityId: string;
  onClose?: () => void;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(forceOpen);
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (setOpen(open), !open && onClose && onClose())}
    >
      {!forceOpen && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Eye />
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="w-1/2 p-0" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>{t("EntityForm Title")}</DialogTitle>
        </VisuallyHidden>
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            {entityType == "line" ? (
              <LineForm entityId={entityId} />
            ) : entityType == "station" ? (
              <StationForm entityId={entityId} />
            ) : entityType == "tool" ? (
              <ToolForm entityId={entityId} />
            ) : entityType == "operation" ? (
              <OperationForm entityId={entityId} />
            ) : (
              ""
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function StringNullToBlank(value: string) {
  return value ? String(value) : "";
}
