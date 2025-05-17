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
} from "../../../wailsjs/go/main/Core";
import { useLocation } from "wouter";
import { navigate } from "wouter/use-browser-location";
import { Plus, Trash2 } from "lucide-react";
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
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../ui/context-menu";

export function EntityCollection({
  entityType,
  parentId,
}: {
  entityType: string;
  parentId: string;
}) {
  const { data: entities } = useQuery({
    queryKey: ["entities", entityType, parentId],
    queryFn: () => GetAllEntities(entityType, String(parentId)),
  });

  return (
    <div className="flex flex-wrap gap-7">
      {entities?.map((entity, index) => (
        <EntityCard
          entityType={entityType}
          entityId={entity.ID}
          entityName={entity.Name}
          entityDescription={entity.Description}
          key={index}
        />
      ))}
      <CreateEntityCard entityType={entityType} parentId={parentId} />
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
    onSuccess: () => queryClient.invalidateQueries(),
  });

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
  entityDescription,
}: {
  entityType: string;
  entityId: string;
  entityName: string;
  entityDescription: string;
}) {
  const location = useLocation();

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card
                className="w-36 hover:cursor-pointer hover:shadow-md transition-shadow h-fit flex flex-col justify-center items-center px-5 py-1 gap-2"
                onClick={() => {
                  navigate(`${location}${entityType}/${entityId}`);
                }}
              >
                <CardTitle className="break-words w-full max-w-full text-center">
                  {entityName}
                  Test{" "}
                </CardTitle>
              </Card>
            </TooltipTrigger>
            <TooltipContent>{entityDescription}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-0">
        <ContextMenuItem onSelect={(e) => e.preventDefault()}>
          <DeleteEntityDialog entityType={entityType} entityId={entityId} />
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>1</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem>2</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DeleteEntityDialog({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
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
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[300px]">
        <DialogHeader>
          <DialogTitle>{t("DeleteDialog Title")}</DialogTitle>
          <DialogDescription>{t("DeleteDialog Description")}</DialogDescription>
        </DialogHeader>
        <Button
          variant="outline"
          onClick={() =>
            deleteEntity({
              name: String(localStorage.getItem("name")),
              entityType: entityType,
              entityId: entityId,
            })
          }
        >
          {t("Understood")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
