import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  GetAllEntities,
  GetOperationsByStation,
  CreateEntity,
} from "../../../wailsjs/go/main/Core";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteEntityDialog } from "./EntityCollection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Ellipsis } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Reorder } from "framer-motion";

export function SequenceGroupView({
  entityType,
  parentId,
}: {
  entityType: string;
  parentId: string;
}) {
  const { suuid } = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { t } = useTranslation();

  type Operation = {
    ID: string;
    Name: string;
    SequenceGroup: string;
    Sequence: number;
  };

  type Group = {
    ID: string;
    Name: string;
    Index: string;
    Operations: Operation[];
  };

  const { data: entitiesOp } = useQuery({
    queryKey: ["entitiesOp", entityType, parentId],
    queryFn: async () => await GetOperationsByStation(suuid),
  });

  const { data: entitiesSequenceGroup } = useQuery({
    queryKey: ["entitiesSequenceGroup", entityType, parentId],
    queryFn: async (): Promise<Group[]> => {
      const groups = await GetAllEntities(entityType, String(parentId));
      const groupsWithOperations: Group[] = await Promise.all(
        (groups ?? []).map(async (group: any) => {
          const rawOps = await GetAllEntities("operation", group.ID);
          const operations: Operation[] = (rawOps ?? []).map((op: any) => ({
            ID: op.ID,
            Name: op.Name,
            SequenceGroup: op.SequenceGroup,
            Sequence: op.Sequence,
          })).sort((a, b) => a.Sequence - b.Sequence);

          return {
            ID: group.ID,
            Name: group.Name ?? "Unnamed",
            Index: group.Index,
            Operations: operations,
          };
        })
      );
      return groupsWithOperations.sort((a, b) => parseInt(a.Index) - parseInt(b.Index));
    },
  });

  const [inputValue, setInputValue] = useState("");

  return (
    <div className="grid grid-cols-2 px-5">
      <ScrollArea className="h-[87.5vh]">
        <div className="flex flex-col gap-3 p-8">
          {entitiesOp?.map((entity, index) => (
            <Card
              key={index}
              className="w-36 h-fit flex relative justify-center items-center hover:cursor-pointer hover:translate-y-1 transition-all"
            >
              <div className="font-bold text-sm text-center">
                {entity.Name || t("unnamed_entity")}
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>

      <ScrollArea className="h-[87.5vh]">
        <div className="flex flex-col gap-3 p-8">
          <Reorder.Group
            values={entitiesSequenceGroup ?? []}
            onReorder={() => {}}
            className="flex flex-col gap-3"
          >
            {entitiesSequenceGroup?.map((group, index) => (
              <Reorder.Item value={group} key={index}>
                <SequenceGroupCard
                  key={index}
                  entityType={entityType}
                  entityId={group.ID}
                  entityName={group.Name || t("unnamed_group")}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />

          <CreateSequenceGroupCard
            name={t("Create Sequencegroup")}
            entityType={entityType}
            parentId={parentId}
            sequenceGroupName={inputValue}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function CreateSequenceGroupCard({
  name,
  entityType,
  parentId,
  sequenceGroupName,
}: {
  name: string;
  entityType: string;
  parentId: string;
  sequenceGroupName: string;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { mutateAsync: createEntity } = useMutation({
    mutationFn: ({
      username,
      entityType,
      parentId,
      sequenceGroupName,
    }: {
      username: string;
      entityType: string;
      parentId: string;
      sequenceGroupName: string;
    }) => {
      return CreateEntity(username, entityType, parentId, sequenceGroupName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success(`${t(entityType)} ${t("CreateToast")}`);
    },
  });

  return (
    <Card
      className="w-36 h-fit flex relative justify-center items-center hover:cursor-pointer hover:translate-y-1 transition-all"
      onClick={async () =>
        await createEntity({
          username: String(localStorage.getItem("name")),
          entityType: entityType,
          parentId: parentId,
          sequenceGroupName: sequenceGroupName,
        })
      }
    >
      <Button variant="ghost" size="icon" className="hover:bg-card">
        {name}
      </Button>
    </Card>
  );
}

function SequenceGroupCard({
  entityType,
  entityId,
  entityName,
}: {
  entityType: string;
  entityId: string;
  entityName: string;
}) {
  const { t } = useTranslation();
  const [key, setKey] = useState(0);

  return (
    <Card className="w-36 h-fit flex relative justify-center items-center hover:cursor-pointer hover:translate-y-1 transition-all">
      <div>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <CardTitle>{entityName || t("unnamed_group")}</CardTitle>
      </div>
    </Card>
  );
}