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
} from "../../../wailsjs/go/main/Core";
import { Eye, FileUp, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
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
import { Input } from "../ui/input";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { LineForm } from "./EntityForms";
import { useInit } from "@/App";

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

  return (
    <div className="flex flex-col gap-7 w-full">
      <div className="flex items-start w-full justify-center">
        <Input
          className="w-64"
          type="text"
          placeholder={t("Search")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-7">
        {entities?.map(
          (entity, index) =>
            StringNullToBlank(entity.Name).includes(filter) && (
              <EntityCard
                entityType={entityType}
                entityId={entity.ID}
                entityName={entity.Name}
                entityComment={entity.Comment}
                link={link}
                key={index}
              />
            )
        )}
        <CreateEntityCard entityType={entityType} parentId={parentId} />
      </div>
    </div>
  );
}

function CreateEntityCard({
  entityType,
  parentId,
}: {
  entityType: string;
  parentId: string;
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
    }) => CreateEntity(name, entityType, parentId),
    onSuccess: () => (
      queryClient.invalidateQueries(),
      toast(`${t(entityType)} ${t("CreateToast")}`)
    ),
    onError: () => {
      appRerender();
    },
  });

  const { appRerender } = useInit();

  return (
    <Card
      className="w-36 flex justify-center items-center hover:cursor-pointer hover:shadow-md transition-shadow"
      onClick={() =>
        createEntity({
          name: String(localStorage.getItem("name")),
          entityType: entityType,
          parentId: parentId,
        })
      }
    >
      <Button variant="ghost" size="icon" className="hover:bg-background">
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
  link,
}: {
  entityType: string;
  entityId: string;
  entityName: string;
  entityComment: string;
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
                className="w-36 hover:cursor-pointer hover:shadow-md transition-shadow h-fit flex flex-col justify-center items-center px-5 py-1 gap-2"
              >
                <CardTitle className="break-words w-full max-w-full text-center">
                  {entityName}
                </CardTitle>
              </Card>
            </TooltipTrigger>
            {typeof entityComment == "string" && entityComment != "" && (
              <TooltipContent>{entityComment}</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-0">
        <FormEntityDialog onClose={() => setKey((k) => k + 1)} />
        <ContextMenuSeparator />
        <DeleteEntityDialog
          entityType={entityType}
          entityId={entityId}
          onClose={() => setKey((k) => k + 1)}
        />
        <ContextMenuSeparator />
        <ExportEntityDialog
          entityType={entityType}
          entityId={entityId}
          onClick={() => setKey((k) => k + 1)}
        />
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
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>{t("DeleteDialog Title")}</DialogTitle>
          <DialogDescription>{`${t("DeleteDialog Description1")} ${t(
            entityType
          )}${t("DeleteDialog Description2")}`}</DialogDescription>
        </DialogHeader>
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

function ExportEntityDialog({
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

function FormEntityDialog({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => (setOpen(open), !open && onClose && onClose())}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Eye />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[300px]">
        <LineForm />
      </DialogContent>
    </Dialog>
  );
}

export function StringNullToBlank(value: string) {
  return value ? String(value) : "";
}
