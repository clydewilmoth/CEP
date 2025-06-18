import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  GetAllEntities,
  GetOperationsByStation,
  CreateEntitySequenceGroup,
  UpdateEntityFieldsStringSequenceGroup,
  GetEntityDetails,
} from "../../../wailsjs/go/main/Core";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteEntityDialog } from "./EntityCollection";
import { ScrollArea } from "../ui/scroll-area";
import { Reorder } from "framer-motion";
import React, { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, Info, Plus } from "lucide-react"; // Added for up/down buttons
import { Loader } from "../ui/loader";

type Group = {
  ID: string;
  Name: string;
  Index: string;
  UpdatedAt: string;
  SerialOperations: Operation[];
  ParallelOperations: Operation[];
};

type Operation = {
  ID: string;
  Name: string;
  SequenceGroup: string;
  Sequence: string;
  UpdatedAt: string;
  SerialOrParallel: string;
  GroupID: string;
};

type ReorderState = {
  groups: Group[];
  unassignedSerialOperations: Operation[];
  unassignedParallelOperations: Operation[];
  unassignedNoneOperations: Operation[];
  inputValue: string;
};

export function SequenceGroupView({
  entityType,
  parentId,
}: {
  entityType: string;
  parentId: string;
}) {
  const { suuid } = useParams<{
    luuid: string;
    suuid: string;
    tuuid: string;
  }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: processedData } = useQuery({
    queryKey: ["sequenceGroupsWithOperations", entityType, parentId, suuid],
    queryFn: async (): Promise<ReorderState> => {
      const [groupsData, allOperationsData] = await Promise.all([
        GetAllEntities(entityType, String(parentId)),
        GetOperationsByStation(String(suuid)),
      ]);

      const groups: any[] = groupsData ?? [];
      const allOperations: any[] = allOperationsData ?? [];

      const groupsWithOperations: Group[] = groups
        .map((group: any) => {
          const operationsForGroup: Operation[] = allOperations
            .filter((op: any) => op.GroupID === group.ID)
            .map((op: any) => ({
              ID: op.ID,
              Name: op.Name,
              SequenceGroup: op.SequenceGroup || "",
              Sequence: op.Sequence,
              UpdatedAt: op.UpdatedAt,
              SerialOrParallel: op.SerialOrParallel,
              GroupID: op.GroupID || "",
            }));

          return {
            ID: group.ID,
            Name: group.Name ?? t("unnamed_group"),
            Index: group.Index,
            UpdatedAt: group.UpdatedAt,
            SerialOperations: operationsForGroup
              .filter((op) => op.SerialOrParallel === "0")
              .sort((a, b) => parseInt(a.Sequence) - parseInt(b.Sequence)),
            ParallelOperations: operationsForGroup.filter(
              (op) => op.SerialOrParallel === "1"
            ),
          };
        })
        .sort((a, b) => parseInt(a.Index) - parseInt(b.Index));

      const unassignedSerialOperations: Operation[] = allOperations
        .filter((op: any) => !op.GroupID && !op.SequenceGroup)
        .filter((op: any) => op.SerialOrParallel === "0")
        .map((op: any) => ({
          ID: op.ID,
          Name: op.Name,
          SequenceGroup: op.SequenceGroup || "",
          Sequence: op.Sequence || "",
          UpdatedAt: op.UpdatedAt || "",
          SerialOrParallel: op.SerialOrParallel || "",
          GroupID: op.GroupID || "",
        }));

      const unassignedParallelOperations: Operation[] = allOperations
        .filter((op: any) => !op.GroupID && !op.SequenceGroup)
        .filter((op: any) => op.SerialOrParallel === "1")
        .map((op: any) => ({
          ID: op.ID,
          Name: op.Name,
          SequenceGroup: op.SequenceGroup || "",
          Sequence: op.Sequence || "",
          UpdatedAt: op.UpdatedAt || "",
          SerialOrParallel: op.SerialOrParallel || "",
          GroupID: op.GroupID || "",
        }));

      const unassignedNoneOperations: Operation[] = allOperations
        .filter((op: any) => !op.GroupID && !op.SequenceGroup)
        .filter(
          (op: any) =>
            op.SerialOrParallel === null || op.SerialOrParallel === "none"
        )
        .map((op: any) => ({
          ID: op.ID,
          Name: op.Name,
          SequenceGroup: op.SequenceGroup || "",
          Sequence: op.Sequence || "",
          UpdatedAt: op.UpdatedAt || "",
          SerialOrParallel: op.SerialOrParallel || "",
          GroupID: op.GroupID || "",
        }));

      return {
        groups: groupsWithOperations,
        unassignedSerialOperations: unassignedSerialOperations,
        unassignedParallelOperations: unassignedParallelOperations,
        unassignedNoneOperations: unassignedNoneOperations,
        inputValue: "",
      };
    },
  });

  const moveOperationMutation = useMutation({
    mutationFn: async ({
      operationId,
      targetGroupId,
      sourceData,
    }: {
      operationId: string;
      targetGroupId: string;
      sourceData: ReorderState;
    }) => {
      let operation: Operation | undefined;

      const unassignedSerialIndex =
        sourceData.unassignedSerialOperations.findIndex(
          (op) => op.ID === operationId
        );
      const unassignedParalelIndex =
        sourceData.unassignedParallelOperations.findIndex(
          (op) => op.ID === operationId
        );

      if (unassignedSerialIndex !== -1) {
        operation =
          sourceData.unassignedSerialOperations[unassignedSerialIndex];
      } else if (unassignedParalelIndex !== -1) {
        operation =
          sourceData.unassignedParallelOperations[unassignedParalelIndex];
      } else {
        for (const group of sourceData.groups) {
          let opIndex = group.SerialOperations.findIndex(
            (op) => op.ID === operationId
          );
          if (opIndex !== -1) {
            operation = group.SerialOperations[opIndex];
            break;
          }
          opIndex = group.ParallelOperations.findIndex(
            (op) => op.ID === operationId
          );
          if (opIndex !== -1) {
            operation = group.ParallelOperations[opIndex];
            break;
          }
        }
      }

      if (!operation) throw new Error("Operation not found for moving");

      let newUnassignedSerialOperations =
        sourceData.unassignedSerialOperations.filter(
          (op) => op.ID !== operationId
        );
      let newUnassignedParallelOperations =
        sourceData.unassignedParallelOperations.filter(
          (op) => op.ID !== operationId
        );
      let newGroups = sourceData.groups.map((group) => ({
        ...group,
        SerialOperations: group.SerialOperations.filter(
          (op) => op.ID !== operationId
        ),
        ParallelOperations: group.ParallelOperations.filter(
          (op) => op.ID !== operationId
        ),
      }));

      if (targetGroupId === "") {
        if (operation.SerialOrParallel === "0") {
          newUnassignedSerialOperations = [
            ...newUnassignedSerialOperations,
            { ...operation, SequenceGroup: "", GroupID: "" },
          ];
        } else if (operation.SerialOrParallel === "1") {
          newUnassignedParallelOperations = [
            ...newUnassignedParallelOperations,
            { ...operation, SequenceGroup: "", GroupID: "" },
          ];
        }
      } else {
        const targetGroup = newGroups.find((g) => g.ID === targetGroupId);
        if (targetGroup) {
          if (operation.SerialOrParallel === "1") {
            targetGroup.ParallelOperations.push({
              ...operation,
              SequenceGroup: targetGroup.Index,
              GroupID: targetGroup.ID,
            });
          } else if (operation.SerialOrParallel === "0") {
            targetGroup.SerialOperations.push({
              ...operation,
              SequenceGroup: targetGroup.Index,
              GroupID: targetGroup.ID,
            });
          }
        }
      }

      return {
        groups: newGroups,
        unassignedSerialOperations: newUnassignedSerialOperations,
        unassignedParallelOperations: newUnassignedParallelOperations,
        unassignedNoneOperations: sourceData.unassignedNoneOperations,
        inputValue: sourceData.inputValue,
      };
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(
        ["sequenceGroupsWithOperations", entityType, parentId, suuid],
        newData
      );
    },
  });

  const reorderOperationsMutation = useMutation({
    mutationFn: async ({
      groupId,
      newOperations,
      type,
      sourceData,
    }: {
      groupId: string;
      newOperations: Operation[];
      type: string;
      sourceData: ReorderState;
    }) => {
      const newGroups = sourceData.groups.map((group) => {
        if (group.ID === groupId) {
          if (type === "0") {
            return {
              ...group,
              SerialOperations: newOperations.map((op, index) => ({
                ...op,
                Sequence: String(index + 1),
              })),
            };
          } else if (type === "1") {
            return {
              ...group,
              ParallelOperations: newOperations.map((op) => ({
                ...op,
                Sequence: "0",
              })),
            };
          }
        }
        return group;
      });

      return {
        ...sourceData,
        groups: newGroups,
      };
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(
        ["sequenceGroupsWithOperations", entityType, parentId, suuid],
        newData
      );
    },
  });

  const reorderGroupsMutation = useMutation({
    mutationFn: async ({
      newGroups,
      sourceData,
    }: {
      newGroups: Group[];
      sourceData: ReorderState;
    }) => {
      const updatedGroupsWithIndex = newGroups.map((group, index) => ({
        ...group,
        Index: String(index + 1),
        SerialOperations: group.SerialOperations.map((op) => ({
          ...op,
          SequenceGroup: String(index + 1),
        })),
        ParallelOperations: group.ParallelOperations.map((op) => ({
          ...op,
          SequenceGroup: String(index + 1),
        })),
      }));
      return {
        ...sourceData,
        groups: updatedGroupsWithIndex,
      };
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(
        ["sequenceGroupsWithOperations", entityType, parentId, suuid],
        newData
      );
    },
  });

  const reorderUnassignedMutation = useMutation({
    mutationFn: async ({
      newOperations,
      type,
      sourceData,
    }: {
      newOperations: Operation[];
      type: "serial" | "parallel";
      sourceData: ReorderState;
    }) => {
      if (type === "serial") {
        return {
          ...sourceData,
          unassignedSerialOperations: newOperations,
        };
      } else {
        return {
          ...sourceData,
          unassignedParallelOperations: newOperations,
        };
      }
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(
        ["sequenceGroupsWithOperations", entityType, parentId, suuid],
        newData
      );
    },
  });

  const updateInputMutation = useMutation({
    mutationFn: async ({
      newInputValue,
      sourceData,
    }: {
      newInputValue: string;
      sourceData: ReorderState;
    }) => {
      return {
        ...sourceData,
        inputValue: newInputValue,
      };
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(
        ["sequenceGroupsWithOperations", entityType, parentId, suuid],
        newData
      );
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async ({
      groupId,
      sourceData,
    }: {
      groupId: string;
      sourceData: ReorderState;
    }) => {
      const groupToDelete = sourceData.groups.find(
        (group) => group.ID === groupId
      );
      let newUnassignedSerialOperations = [
        ...sourceData.unassignedSerialOperations,
      ];
      let newUnassignedParallelOperations = [
        ...sourceData.unassignedParallelOperations,
      ];

      if (groupToDelete) {
        const opsToMove = [
          ...groupToDelete.SerialOperations.map((op) => ({
            ...op,
            SequenceGroup: "",
            Sequence: "",
            GroupID: "",
          })),
          ...groupToDelete.ParallelOperations.map((op) => ({
            ...op,
            SequenceGroup: "",
            Sequence: "",
            GroupID: "",
          })),
        ];

        if (opsToMove.length > 0) {
          for (const op of opsToMove) {
            try {
              await UpdateEntityFieldsStringSequenceGroup(
                localStorage.getItem("name") || "",
                "operation",
                op.ID,
                op.UpdatedAt,
                {
                  Sequence: "",
                  SequenceGroup: "",
                  GroupID: "",
                }
              );
            } catch (error) {
              console.error(
                "Error unassigning operation on group delete:",
                error
              );
            }
          }
          newUnassignedSerialOperations.push(
            ...opsToMove.filter((op) => op.SerialOrParallel === "0")
          );
          newUnassignedParallelOperations.push(
            ...opsToMove.filter((op) => op.SerialOrParallel === "1")
          );
        }
      }

      const newGroups = sourceData.groups
        .filter((group) => group.ID !== groupId)
        .map((group, index) => ({
          ...group,
          Index: String(index + 1),
          SerialOperations: group.SerialOperations.map((op) => ({
            ...op,
            SequenceGroup: String(index + 1),
          })),
          ParallelOperations: group.ParallelOperations.map((op) => ({
            ...op,
            SequenceGroup: String(index + 1),
          })),
        }));

      return {
        ...sourceData,
        groups: newGroups,
        unassignedSerialOperations: newUnassignedSerialOperations,
        unassignedParallelOperations: newUnassignedParallelOperations,
      };
    },
    onSuccess: (newData, variables) => {
      queryClient.setQueryData(
        ["sequenceGroupsWithOperations", entityType, parentId, suuid],
        newData
      );
      queryClient.invalidateQueries({
        queryKey: ["sequenceGroupsWithOperations", entityType, parentId, suuid],
      });
    },
    onError: (error) => {
      toast.error(t("failed_to_delete_group"));
      console.error("Error deleting group:", error);
    },
  });

  const handleMoveOperation = (operationId: string, targetGroupId: string) => {
    if (processedData) {
      moveOperationMutation.mutate({
        operationId,
        targetGroupId,
        sourceData: processedData,
      });
    }
  };

  const handleReorderOperationsInGroup = (
    groupId: string,
    newOperations: Operation[],
    type: string
  ) => {
    if (processedData) {
      reorderOperationsMutation.mutate({
        groupId,
        newOperations,
        type,
        sourceData: processedData,
      });
    }
  };

  const handleReorderGroups = (newGroups: Group[]) => {
    if (processedData) {
      reorderGroupsMutation.mutate({ newGroups, sourceData: processedData });
    }
  };

  const handleReorderUnassigned = (
    newOperations: Operation[],
    type: "serial" | "parallel"
  ) => {
    if (processedData) {
      reorderUnassignedMutation.mutate({
        newOperations,
        type,
        sourceData: processedData,
      });
    }
  };

  const handleInputChange = (newInputValue: string) => {
    if (processedData) {
      updateInputMutation.mutate({ newInputValue, sourceData: processedData });
    }
  };

  const handleGroupDelete = (groupId: string) => {
    if (processedData) {
      deleteGroupMutation.mutate({ groupId, sourceData: processedData });
    }
  };

  const [stationType, setStationType] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { StationType } = await GetEntityDetails("station", suuid);
      setStationType(StationType ?? "");
      setLoading(false);
    })();
  }, []);

  if (!processedData) {
    return <div>{t("loading")}...</div>;
  }

  return (
    <>
      {loading ? (
        <Loader />
      ) : stationType == "" || stationType == "none" ? (
        <div className="text-sm font-semibold max-w-lg bg-card border p-4 flex flex-col gap-3 rounded-lg">
          {t("StationType Unassigned")}
        </div>
      ) : stationType == "0" ? (
        <div className="text-sm font-semibold max-w-lg bg-card border p-4 flex flex-col gap-3 rounded-lg">
          {t("StationType Datapump")}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-5 w-[95%]">
            <h1 className="text-lg font-bold">{t("Operations Unassigned")}</h1>
            <ScrollArea className="pr-4 h-[calc(100vh-11rem)]">
              <div
                className="min-h-[100px] border-2 border-dashed rounded-lg p-4 mb-4 transition-all hover:border-accent/70 hover:bg-accent/10"
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove(
                    "border-accent",
                    "bg-accent/20"
                  );
                  const operationId = e.dataTransfer.getData("operationId");
                  const sourceGroupId = e.dataTransfer.getData("sourceGroupId");

                  if (operationId && sourceGroupId !== "") {
                    handleMoveOperation(operationId, "");
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add(
                    "border-accent",
                    "bg-accent/20"
                  );
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    e.currentTarget.classList.remove(
                      "border-accent",
                      "bg-accent/20"
                    );
                  }
                }}
              >
                {" "}
                <div className="flex flex-col gap-4">
                  {/* Serial Operations Section - nur anzeigen wenn Operationen vorhanden */}
                  {processedData.unassignedSerialOperations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 border-b pb-1">
                        {t("SOP_0_name")}
                      </h4>
                      <Reorder.Group
                        axis="y"
                        values={processedData.unassignedSerialOperations}
                        onReorder={(newOrder) =>
                          handleReorderUnassigned(newOrder, "serial")
                        }
                        className="flex flex-wrap gap-2"
                      >
                        {processedData.unassignedSerialOperations.map(
                          (entity) => (
                            <Reorder.Item
                              value={entity}
                              key={entity.ID}
                              dragListener={false}
                              className="cursor-grab hover:cursor-grab active:cursor-grabbing"
                            >
                              <OperationCard
                                operation={entity}
                                currentGroupId=""
                              />
                            </Reorder.Item>
                          )
                        )}
                      </Reorder.Group>
                    </div>
                  )}
                  {/* Parallel Operations Section - nur anzeigen wenn Operationen vorhanden */}
                  {processedData.unassignedParallelOperations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 border-b pb-1">
                        {t("SOP_1_name")}
                      </h4>
                      <Reorder.Group
                        axis="y"
                        values={processedData.unassignedParallelOperations}
                        onReorder={(newOrder) =>
                          handleReorderUnassigned(newOrder, "parallel")
                        }
                        className="flex flex-wrap gap-2"
                      >
                        {processedData.unassignedParallelOperations.map(
                          (entity) => (
                            <Reorder.Item
                              value={entity}
                              key={entity.ID}
                              dragListener={false}
                              className="cursor-grab hover:cursor-grab active:cursor-grabbing"
                            >
                              <OperationCard
                                operation={entity}
                                currentGroupId=""
                              />
                            </Reorder.Item>
                          )
                        )}
                      </Reorder.Group>
                    </div>
                  )}
                  {/* "none" Operations Section - nur anzeigen wenn Operationen vorhanden */}
                  {processedData.unassignedNoneOperations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 border-b pb-1">
                        {t("NeitherSerialParallel")}
                      </h4>
                      <Reorder.Group
                        axis="y"
                        values={processedData.unassignedNoneOperations}
                        onReorder={(newOrder) =>
                          handleReorderUnassigned(newOrder, "parallel")
                        }
                        className="flex flex-wrap gap-2"
                        visibility="disabled"
                      >
                        {processedData.unassignedNoneOperations.map(
                          (entity) => (
                            <Reorder.Item
                              value={entity}
                              key={entity.ID}
                              dragListener={false}
                              className="cursor-grab hover:cursor-grab active:cursor-grabbing"
                            >
                              <OperationCard
                                operation={entity}
                                currentGroupId=""
                              />
                            </Reorder.Item>
                          )
                        )}
                      </Reorder.Group>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </div>
          <div className="flex flex-col gap-5 w-[95%]">
            <h1 className="text-lg font-bold">{t("SequenceGroups")}</h1>
            <ScrollArea className="pr-4 h-[calc(100vh-11rem)]">
              <div className="flex flex-col gap-5">
                {processedData.groups.length > 0 && (
                  <Reorder.Group
                    axis="y"
                    values={processedData.groups || []}
                    onReorder={handleReorderGroups}
                    className="flex flex-col gap-3"
                  >
                    {" "}
                    {(processedData.groups || []).map((group, index) => (
                      <Reorder.Item
                        value={group}
                        key={group.ID}
                        dragListener={true}
                        className="cursor-grab hover:cursor-grab active:cursor-grabbing"
                      >
                        <SequenceGroupCard
                          entityType={entityType}
                          group={group}
                          entityName={group.Name || t("unnamed_group")}
                          visualIndex={index + 1}
                          onMoveOperation={handleMoveOperation}
                          onReorderOperations={handleReorderOperationsInGroup}
                          onDelete={handleGroupDelete}
                        />
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}

                <div className="flex gap-2 w-[99%]">
                  <Input
                    value={processedData.inputValue}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder={t("SequenceGroup CreateInput")}
                  />
                  <div
                    className="w-8 h-8"
                    hidden={processedData.inputValue == ""}
                  >
                    <CreateSequenceGroupCard
                      entityType={entityType}
                      parentId={parentId}
                      sequenceGroupName={processedData.inputValue}
                      currentGroupsCount={processedData.groups.length}
                      onGroupCreated={() => handleInputChange("")}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
          <SubmitGroupsOrderButton
            reorderableGroups={processedData.groups || []}
            unassignedSerialOperations={
              processedData.unassignedSerialOperations || []
            }
            unassignedParallelOperations={
              processedData.unassignedParallelOperations || []
            }
            entityType={entityType}
            parentId={parentId}
            stationSuuid={suuid}
          />
        </div>
      )}
    </>
  );
}

function OperationCard({
  operation,
  currentGroupId,
}: {
  operation: Operation;
  currentGroupId: string;
}) {
  const { t } = useTranslation();

  return (
    <Card
      className="relative w-36 transition-all h-fit flex gap-3 justify-center items-center py-4 hover:translate-y-1"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("operationId", operation.ID);
        e.dataTransfer.setData("sourceGroupId", currentGroupId);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="font-semibold text-sm text-center truncate px-2">
        {operation.Name || t("unnamed_entity")}
      </div>
    </Card>
  );
}

export function SubmitGroupsOrderButton({
  reorderableGroups,
  unassignedSerialOperations,
  unassignedParallelOperations,
  entityType,
  parentId,
  stationSuuid,
}: {
  reorderableGroups: Group[];
  unassignedSerialOperations: Operation[];
  unassignedParallelOperations: Operation[];
  entityType: string;
  parentId: string;
  stationSuuid: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Process groups and their operations
      reorderableGroups.forEach(async (group, groupIndex) => {
        // Update group index

        await UpdateEntityFieldsStringSequenceGroup(
          localStorage.getItem("name") || "",
          "sequencegroup",
          group.ID,
          group.UpdatedAt,
          { Index: String(groupIndex + 1) }
        );

        // Process serial operations
        group.SerialOperations.forEach(async (op, opIndex) => {
          await UpdateEntityFieldsStringSequenceGroup(
            localStorage.getItem("name") || "",
            "operation",
            op.ID,
            op.UpdatedAt,
            {
              Sequence: String(opIndex + 1),
              SequenceGroup: String(groupIndex + 1),
              GroupID: group.ID,
            }
          );
        });

        // Process parallel operations
        group.ParallelOperations.forEach(async (op) => {
          await UpdateEntityFieldsStringSequenceGroup(
            localStorage.getItem("name") || "",
            "operation",
            op.ID,
            op.UpdatedAt,
            {
              Sequence: "0",
              SequenceGroup: String(groupIndex + 1),
              GroupID: group.ID,
            }
          );
        });
      });

      // Process unassigned operations
      unassignedSerialOperations.forEach(async (op) => {
        await UpdateEntityFieldsStringSequenceGroup(
          localStorage.getItem("name") || "",
          "operation",
          op.ID,
          op.UpdatedAt,
          {
            Sequence: "",
            SequenceGroup: "",
            GroupID: "",
          }
        );
      });

      unassignedParallelOperations.forEach(async (op) => {
        await UpdateEntityFieldsStringSequenceGroup(
          localStorage.getItem("name") || "",
          "operation",
          op.ID,
          op.UpdatedAt,
          {
            Sequence: "",
            SequenceGroup: "",
            GroupID: "",
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [
          "sequenceGroupsWithOperations",
          entityType,
          parentId,
          stationSuuid,
        ],
      });
      toast.success(t("order_changes_submitted_successfully"));
    },
    onError: (error) => {
      toast.error(t("failed_to_submit_order_changes"));
      console.error("Error submitting order changes:", error);
    },
  });

  return (
    <Button
      onClick={() => submitMutation.mutate()}
      className="w-fit"
      disabled={submitMutation.isPending}
    >
      {submitMutation.isPending
        ? t("submitting") + "..."
        : t("SequenceGroup Submit")}
    </Button>
  );
}

function CreateSequenceGroupCard({
  entityType,
  parentId,
  sequenceGroupName,
  currentGroupsCount,
  onGroupCreated,
}: {
  entityType: string;
  parentId: string;
  sequenceGroupName: string;
  currentGroupsCount: number;
  onGroupCreated: () => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { suuid } = useParams<{ suuid: string }>();

  const { mutateAsync: createEntity, isPending } = useMutation({
    mutationFn: (data: {
      username: string;
      entityType: string;
      parentId: string;
      sequenceGroupName: string;
      index: string;
    }) => {
      return CreateEntitySequenceGroup(
        data.username,
        data.entityType,
        data.parentId,
        data.sequenceGroupName
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["sequenceGroupsWithOperations", entityType, parentId, suuid],
      });
      toast.success(`${t(entityType)} ${t("create_toast")}`);
      onGroupCreated();
    },
    onError: (error: any) => {
      toast.error(
        `${t("failed_to_create")} ${t(entityType)}: ${
          error.message || t("unknown_error")
        }`
      );
    },
  });

  const handleCreate = async () => {
    if (!sequenceGroupName.trim()) {
      toast.info(t("please_enter_group_name"));
      return;
    }
    await createEntity({
      username: String(localStorage.getItem("name")),
      entityType: entityType,
      parentId: parentId,
      sequenceGroupName: sequenceGroupName,
      index: String(currentGroupsCount + 1),
    });
  };

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleCreate}
      disabled={isPending}
    >
      {isPending ? "..." : <Plus />}
    </Button>
  );
}

function SequenceGroupCard({
  group,
  entityName,
  visualIndex,
  onMoveOperation,
  onReorderOperations,
  onDelete,
}: {
  entityType: string;
  group: Group;
  entityName: string;
  visualIndex: number;
  onMoveOperation: (operationId: string, targetGroupId: string) => void;
  onReorderOperations: (
    groupId: string,
    newOperations: Operation[],
    type: string
  ) => void;
  onDelete: (groupId: string) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const dragOverStateKey = ["dragOverState", group.ID];

  const { data: isDragOver = false } = useQuery({
    queryKey: dragOverStateKey,
    queryFn: () => false,
    staleTime: Infinity,
    enabled: false,
  });

  const setDragOverState = (dragOver: boolean) => {
    queryClient.setQueryData(dragOverStateKey, dragOver);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverState(false);
    e.currentTarget.classList.remove("border-accent", "bg-accent/20");

    const operationId = e.dataTransfer.getData("operationId");
    const sourceGroupId = e.dataTransfer.getData("sourceGroupId");

    if (operationId && sourceGroupId !== group.ID) {
      onMoveOperation(operationId, group.ID);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setDragOverState(true);
      e.currentTarget.classList.add("border-accent", "bg-accent/20");
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverState(false);
      e.currentTarget.classList.remove("border-accent", "bg-accent/20");
    }
  };

  // NEW: Handler for moving operations up or down with buttons
  const handleMoveOperationUpDown = (
    direction: "up" | "down",
    index: number
  ) => {
    const newOperations = [...group.SerialOperations];
    const opToMove = newOperations[index];

    if (direction === "up" && index > 0) {
      newOperations[index] = newOperations[index - 1];
      newOperations[index - 1] = opToMove;
    } else if (direction === "down" && index < newOperations.length - 1) {
      newOperations[index] = newOperations[index + 1];
      newOperations[index + 1] = opToMove;
    } else {
      return;
    }
    onReorderOperations(group.ID, newOperations, "0");
  };

  return (
    <Card
      className="bg-muted w-full h-fit flex flex-col relative p-4 transition-all border-2 border-dashed hover:border-accent/70 hover:bg-accent/10"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center">
            {visualIndex}
          </div>
          <CardTitle className="text-lg">
            {entityName || t("unnamed_group")}
          </CardTitle>
        </div>

        <DeleteEntityDialog
          entityType={"sequencegroup"}
          entityId={group.ID}
          onClose={() => onDelete(group.ID)}
        />
      </div>
      {/* Serial Operations */}
      <div className="mb-6">
        <div className="text-sm font-medium mb-2 border-b pb-1">
          {t("SOP_0_name")} ({group.SerialOperations.length})
        </div>
        {group.SerialOperations.length > 0 ? (
          <Reorder.Group
            axis="y"
            values={group.SerialOperations}
            onReorder={(newOperations) =>
              onReorderOperations(group.ID, newOperations, "0")
            }
            className="flex flex-col gap-2 pl-2"
          >
            {" "}
            {group.SerialOperations.map((operation, opIndex) => (
              <Reorder.Item
                value={operation}
                key={operation.ID}
                dragListener={true}
                className="cursor-grab hover:cursor-grab active:cursor-grabbing"
              >
                {/* MODIFIED: Flex container for order number, card, and buttons */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-muted-foreground w-4 text-right">
                    {opIndex + 1}.
                  </span>
                  <div className="flex-grow">
                    <OperationCard
                      operation={operation}
                      currentGroupId={group.ID}
                    />
                  </div>
                  {/* NEW: Up and Down buttons */}
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveOperationUpDown("up", opIndex)}
                      disabled={opIndex === 0}
                      aria-label={t("move_up")}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveOperationUpDown("down", opIndex)}
                      disabled={opIndex === group.SerialOperations.length - 1}
                      aria-label={t("move_down")}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div
            className={`text-center py-6 border-2 border-dashed rounded transition-all ${
              isDragOver && !group.SerialOperations.length
                ? "border-accent bg-accent/20 text-accent-foreground"
                : "border-muted text-muted-foreground"
            }`}
          >
            {isDragOver && !group.SerialOperations.length && (
              <span className="text-sm">{t("drop_operation_here")}</span>
            )}
          </div>
        )}
      </div>{" "}
      {/* Parallel Operations */}
      <div>
        <div className="text-sm font-medium mb-2 border-b pb-1">
          {t("SOP_1_name")} ({group.ParallelOperations.length})
        </div>
        {group.ParallelOperations.length > 0 ? (
          <Reorder.Group
            axis="y"
            values={group.ParallelOperations}
            onReorder={(newOperations) =>
              onReorderOperations(group.ID, newOperations, "parallel")
            }
            className="flex flex-wrap gap-2 pl-2"
          >
            {" "}
            {group.ParallelOperations.map((operation) => (
              <Reorder.Item
                value={operation}
                key={operation.ID}
                dragListener={true}
                className="cursor-grab hover:cursor-grab active:cursor-grabbing"
              >
                <OperationCard
                  operation={operation}
                  currentGroupId={group.ID}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div
            className={`text-center py-6 border-2 border-dashed rounded transition-all ${
              isDragOver && !group.ParallelOperations.length
                ? "border-accent bg-accent/20 text-accent-foreground"
                : "border-muted text-muted-foreground"
            }`}
          >
            {isDragOver && !group.ParallelOperations.length && (
              <span className="text-sm">{t("drop_operation_here")}</span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
