import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardTitle } from "@/components/ui/card";
import {
    GetAllEntities,
    GetOperationsByStation,
    CreateEntity,
} from "../../../wailsjs/go/main/Core";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";
import { EntityCard } from "@/components/logic/EntityCollection";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SequenceGroupView({
    entityType,
    parentId,
    link,
}: {
    entityType: string;
    parentId: string;
    link: string;
}) {
    const { suuid } = useParams<{ luuid: string; suuid: string; tuuid: string }>();
    const { data: entitiesOp } = useQuery({
        queryKey: ["entitiesOp", entityType, parentId],
        queryFn: async () => await GetOperationsByStation(suuid),
    });
    const { data: entitiesSequenceGroup } = useQuery({
        queryKey: ["entities", entityType, parentId],
        queryFn: async () => await GetAllEntities(entityType, String(parentId)),
    });
    const { t } = useTranslation();
    
    return (
        <div className="flex flex-col gap-7 w-full">
            <div>
                {entitiesOp?.map((entity, index) => {
                    return (
                        <EntityCard
                            entityType={entityType}
                            entityId={String(entity.ID)}
                            entityName={String(entity.Name)}
                            entityComment={String(entity.Comment)}
                            entityStatusColor={ undefined }
                            link={link}
                            key={index}
                        />
                    );
                })}
            </div>
            <div>
                <InputDemo />
                <ButtonDemo 
                    name="selim"
                    entityType={entityType}
                    parentId={parentId}
                    link={link}
                />
                {entitiesSequenceGroup?.map((entity, index) => {
                    return (
                        <div key={index} className="flex items-center gap-4">
                            <p className="text-blue-500 hover:underline">
                                {entity.name || t("unnamed_entity")}
                            </p>
                            <span className="text-sm text-gray-500">
                                {entity.description || t("no_description")}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function createSequenceGroup({
  name,
  entityType,
  parentId,
  link,
}: {
  name: string;
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
    onSuccess: (res) => {
      queryClient.invalidateQueries();
      toast.success(`${t(entityType)} ${t("CreateToast")}`);
    },
  });

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
        <CardTitle className="text-center text-sm font-semibold">
          {name}
        </CardTitle>
      </div>
    </Card>
  );
}

function ButtonDemo({
  name,
  entityType,
  parentId,
  link,
}: {
  name: string;
  entityType: string;
  parentId: string;
  link: string; 
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:flex-row">
      <Button onClick={() => createSequenceGroup({ name, entityType, parentId, link })}>Button</Button>
    </div>
  )
}

function InputDemo() {
  return <Input type="text" />
}