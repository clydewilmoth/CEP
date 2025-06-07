import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  GetAllEntities,
  GetOperationsByStation,
  CreateEntity,
  UpdateEntityFieldsString
} from "../../../wailsjs/go/main/Core";
import { useState, useEffect } from "react";
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

type Group = {
  ID: string;
  Name: string;
  Index: string;
  UpdatedAt: string;
  Operations: Operation[];
};

type Operation = {
  ID: string;
  Name: string;
  SequenceGroup: string;
  Sequence: number;
  UpdatedAt: string;
};

export function SequenceGroupView({
  entityType,
  parentId,
}: {
  entityType: string;
  parentId: string;
}) {
  const { suuid } = useParams<{ luuid: string; suuid: string; tuuid: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: entitiesOp } = useQuery({
    queryKey: ["entitiesOp", entityType, parentId],
    queryFn: async () => await GetOperationsByStation(suuid),
  });

  const { data: entitiesSequenceGroup } = useQuery({
    queryKey: ["entitiesSequenceGroup", entityType, parentId],
    queryFn: async (): Promise<Group[]> => {
      const groups = await GetAllEntities(entityType, String(parentId));
      // Get all operations for this station
      const allOperations = await GetOperationsByStation(suuid);
      
      const groupsWithOperations: Group[] = (groups ?? []).map((group: any) => {
        // Find operations that belong to this group
        const operations: Operation[] = (allOperations ?? [])
          .filter((op: any) => op.GroupID === group.ID || op.SequenceGroup === group.Index)
          .map((op: any) => ({
            ID: op.ID,
            Name: op.Name,
            SequenceGroup: op.SequenceGroup,
            Sequence: op.Sequence,
            UpdatedAt: op.UpdatedAt,
          }))
          .sort((a, b) => a.Sequence - b.Sequence);

        return {
          ID: group.ID,
          Name: group.Name ?? "Unnamed",
          Index: group.Index,
          UpdatedAt: group.UpdatedAt,
          Operations: operations,
        };
      });
      
      return groupsWithOperations.sort((a, b) => parseInt(a.Index) - parseInt(b.Index));
    },
  });

  const [reorderableGroups, setReorderableGroups] = useState<Group[]>([]);
  const [unassignedOperations, setUnassignedOperations] = useState<Operation[]>([]);

  useEffect(() => {
    if (entitiesSequenceGroup) {
      setReorderableGroups(entitiesSequenceGroup);
    }
  }, [entitiesSequenceGroup]);

  useEffect(() => {
    if (entitiesOp) {
      const operations: Operation[] = entitiesOp
        .filter((op: any) => !op.SequenceGroup && !op.GroupID)
        .map((op: any) => ({
          ID: op.ID,
          Name: op.Name,
          SequenceGroup: op.SequenceGroup || "",
          Sequence: op.Sequence || 0,
          UpdatedAt: op.UpdatedAt || "",
        }));

      setUnassignedOperations(operations);
    }
  }, [entitiesOp]);

  const [inputValue, setInputValue] = useState("");

  // Handle moving operations between groups and unassigned
  const moveOperationToGroup = (operationId: string, targetGroupId: string) => {
    // Find the operation in unassigned or other groups
    let operation: Operation | undefined;
    
    // Check unassigned operations first
    const unassignedIndex = unassignedOperations.findIndex(op => op.ID === operationId);
    if (unassignedIndex !== -1) {
      operation = unassignedOperations[unassignedIndex];
      setUnassignedOperations(prev => prev.filter(op => op.ID !== operationId));
    } else {
      // Check in groups
      setReorderableGroups(prev => prev.map(group => {
        const opIndex = group.Operations.findIndex(op => op.ID === operationId);
        if (opIndex !== -1) {
          operation = group.Operations[opIndex];
          return {
            ...group,
            Operations: group.Operations.filter(op => op.ID !== operationId)
          };
        }
        return group;
      }));
    }

    if (operation) {
      if (targetGroupId === 'unassigned') {
        // Move to unassigned
        setUnassignedOperations(prev => [...prev, { ...operation!, SequenceGroup: "" }]);
      } else {
        // Move to specific group
        setReorderableGroups(prev => prev.map(group => {
          if (group.ID === targetGroupId) {
            return {
              ...group,
              Operations: [...group.Operations, { ...operation!, SequenceGroup: group.Index }]
            };
          }
          return group;
        }));
      }
    }
  };

  // Handle reordering operations within a group
  const reorderOperationsInGroup = (groupId: string, newOperations: Operation[]) => {
    setReorderableGroups(prev => prev.map(group => 
      group.ID === groupId ? { ...group, Operations: newOperations } : group
    ));
  };

  // Handle group deletion and move its operations to unassigned
  const handleGroupDelete = async (groupId: string) => {
    // Find the group being deleted
    const groupToDelete = reorderableGroups.find(group => group.ID === groupId);
    
    if (groupToDelete && groupToDelete.Operations.length > 0) {
      // Move all operations from this group to unassigned
      const operationsToMove = groupToDelete.Operations.map(op => ({
        ...op,
        SequenceGroup: "",
        Sequence: 0
      }));
      
      // Update operations in the database to unassign them
      for (const op of operationsToMove) {
        try {
          await UpdateEntityFieldsString(
            localStorage.getItem("name") || "", 
            "operation", 
            op.ID, 
            op.UpdatedAt, 
            { 
              "Sequence": "0",
              "SequenceGroup": "", 
              "GroupID": ""
            }
          );
        } catch (error) {
          console.error("Error unassigning operation:", error);
        }
      }
      
      // Update local state
      setUnassignedOperations(prev => [...prev, ...operationsToMove]);
    }
    
    // Remove the group from local state
    setReorderableGroups(prev => prev.filter(group => group.ID !== groupId));
    
    // Refresh queries to ensure data consistency
    queryClient.invalidateQueries({ queryKey: ["entitiesOp", entityType, parentId] });
    queryClient.invalidateQueries({ queryKey: ["entitiesSequenceGroup", entityType, parentId] });
  };

  return (
    <div className="grid grid-cols-2 px-5">
      <ScrollArea className="h-[87.5vh]">
        <div className="flex flex-col gap-3 p-8">
          <h3 className="text-lg font-semibold mb-4">Unassigned Operations</h3>
          
          {/* Drop zone for unassigned operations */}
          <div 
            className="min-h-[100px] border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4 transition-all hover:border-gray-400"
            onDrop={(e) => {
              e.preventDefault();
              const operationId = e.dataTransfer.getData('operationId');
              const sourceGroupId = e.dataTransfer.getData('sourceGroupId');
              
              if (operationId && sourceGroupId !== 'unassigned') {
                moveOperationToGroup(operationId, 'unassigned');
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
              }
            }}
          >
            <Reorder.Group
              values={unassignedOperations}
              onReorder={setUnassignedOperations}
              className="flex flex-col gap-3"
            >
              {unassignedOperations?.map((entity) => (
                <Reorder.Item value={entity} key={entity.ID}>
                  <OperationCard
                    operation={entity}
                    onMoveToGroup={moveOperationToGroup}
                    currentGroupId="unassigned"
                    availableGroups={reorderableGroups}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
            
            {unassignedOperations.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                Drag operations here to unassign them
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <ScrollArea className="h-[87.5vh]">
        <div className="flex flex-col gap-3 p-8">
          <Reorder.Group
            values={reorderableGroups}
            onReorder={setReorderableGroups}
            className="flex flex-col gap-3"
          >
            {reorderableGroups.map((group, index) => (
              <Reorder.Item value={group} key={group.ID}>
                <SequenceGroupCard
                  key={group.ID}
                  entityType={entityType}
                  group={group}
                  entityName={group.Name || t("unnamed_group")}
                  visualIndex={index + 1}
                  onMoveOperation={moveOperationToGroup}
                  onReorderOperations={reorderOperationsInGroup}
                  availableGroups={reorderableGroups}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>

          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter group name"
          />

          <CreateSequenceGroupCard
            name={t("Create Sequencegroup")}
            entityType={entityType}
            parentId={parentId}
            sequenceGroupName={inputValue}
          />
          <SubmitGroupsOrderButton 
            reorderableGroups={reorderableGroups} 
            unassignedOperations={unassignedOperations}
            onSubmitComplete={() => {
              // Refresh the data after submission
              queryClient.invalidateQueries({ queryKey: ["entitiesOp", entityType, parentId] });
              queryClient.invalidateQueries({ queryKey: ["entitiesSequenceGroup", entityType, parentId] });
            }}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function OperationCard({
  operation,
  onMoveToGroup,
  currentGroupId,
  availableGroups,
}: {
  operation: Operation;
  onMoveToGroup: (operationId: string, targetGroupId: string) => void;
  currentGroupId: string;
  availableGroups: Group[];
}) {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  return (
    <Card
      className={`w-full max-w-xs h-fit flex relative justify-center items-center hover:cursor-grab active:cursor-grabbing transition-all p-3 ${
        isDragging ? 'opacity-50 scale-95' : 'hover:shadow-md'
      }`}
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('operationId', operation.ID);
        e.dataTransfer.setData('sourceGroupId', currentGroupId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setIsDragging(false)}
    >
      <div className="font-bold text-sm text-center">
        {operation.Name || t("unnamed_entity")}
      </div>
    </Card>
  );
}

export function SubmitGroupsOrderButton({
  reorderableGroups,
  unassignedOperations,
  onSubmitComplete
}: {
  reorderableGroups: Group[];
  unassignedOperations: Operation[];
  onSubmitComplete: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClick = async () => {
    setIsSubmitting(true);
    try {
      let countIndex = 1;

      // Update groups and their operations
      for (const group of reorderableGroups) { 
        await UpdateEntityFieldsString(
          localStorage.getItem("name") || "", 
          "sequencegroup", 
          group.ID, 
          group.UpdatedAt, 
          { "Index": String(countIndex) }
        );
        countIndex++;

        let operationSequence = 1;
        for (const op of group.Operations) {
          await UpdateEntityFieldsString(
            localStorage.getItem("name") || "", 
            "operation", 
            op.ID, 
            op.UpdatedAt, 
            { 
              "Sequence": String(operationSequence),
              "SequenceGroup": String(countIndex - 1), // Use the current group index
              "GroupID": group.ID
            }
          );
          operationSequence++;
        }
      }

      // Update unassigned operations
      for (const op of unassignedOperations) {
        await UpdateEntityFieldsString(
          localStorage.getItem("name") || "", 
          "operation", 
          op.ID, 
          op.UpdatedAt, 
          { 
            "Sequence": "0",
            "SequenceGroup": "", 
            "GroupID": ""
          }
        );
      }

      // Trigger data refresh
      onSubmitComplete();
      toast.success("Order changes submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit order changes");
      console.error("Error submitting order changes:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button 
      onClick={handleClick} 
      className="w-full" 
      disabled={isSubmitting}
    >
      {isSubmitting ? "Submitting..." : "Submit Order Changes"}
    </Button>
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
  group,
  entityName,
  visualIndex,
  onMoveOperation,
  onReorderOperations,
  availableGroups,
}: {
  entityType: string;
  group: Group;
  entityName: string;
  visualIndex: number;
  onMoveOperation: (operationId: string, targetGroupId: string) => void;
  onReorderOperations: (groupId: string, newOperations: Operation[]) => void;
  availableGroups: Group[];
}) {
  const { t } = useTranslation();
  const [key, setKey] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const operationId = e.dataTransfer.getData('operationId');
    const sourceGroupId = e.dataTransfer.getData('sourceGroupId');
    
    if (operationId && sourceGroupId !== group.ID) {
      onMoveOperation(operationId, group.ID);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set drag over to false if we're leaving the card entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  return (
    <Card 
      className={`w-full h-fit flex flex-col relative p-4 transition-all border-2 ${
        isDragOver 
          ? 'border-blue-400 bg-blue-50 shadow-lg scale-[1.02]' 
          : 'border-dashed border-gray-300 hover:border-gray-400'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-lg font-bold">{visualIndex}</div>
          <CardTitle className="text-lg">{entityName || t("unnamed_group")}</CardTitle>
        </div>
        
            <DeleteEntityDialog
              entityType={entityType}
              entityId={group.ID}
              onClose={() => setKey((k) => k + 1)}
            />
          
        
      </div>

      {/* Operations within the group */}
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-600 mb-2">
          Operations ({group.Operations.length})
        </div>
        
        {group.Operations.length > 0 ? (
          <div className="space-y-2">
            <Reorder.Group
              values={group.Operations}
              onReorder={(newOperations) => onReorderOperations(group.ID, newOperations)}
              className="flex flex-col gap-2"
            >
              {group.Operations.map((operation) => (
                <Reorder.Item value={operation} key={operation.ID}>
                  <OperationCard
                    operation={operation}
                    onMoveToGroup={onMoveOperation}
                    currentGroupId={group.ID}
                    availableGroups={availableGroups}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        ) : (
          <div className={`text-center py-8 border-2 border-dashed rounded transition-all ${
            isDragOver 
              ? 'border-blue-400 bg-blue-100 text-blue-600' 
              : 'border-gray-200 text-gray-400'
          }`}>
            {isDragOver ? 'Drop operation here' : 'Drag operations here'}
          </div>
        )}
      </div>
    </Card>
  );
}