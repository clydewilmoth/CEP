import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, SquarePen, History } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GetAllEntities,
  GetEntityDetails,
  GetEntityVersions,
  UpdateEntityFieldsString,
} from "../../../wailsjs/go/main/Core";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import data from "@/assets/dependency.json";
import { TagsInput } from "../ui/tags-input";
import { useContext } from "@/store";
import { Checkbox } from "../ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { booleanToString, formatTimestamp, stringToBoolean } from "@/lib/utils";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@radix-ui/react-dropdown-menu";
import { ScrollArea } from "../ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { useDelayedLoading } from "@/lib/hooks";

export function LineForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState, lastUpdate } = useContext();
  const { t, i18n } = useTranslation();
  const [draftAvailable, setDraftAvailable] = useState(false);

  // Use delayed loading to prevent skeleton flickering
  const showSkeletons = useDelayedLoading(!formReady);

  useEffect(() => {
    (async () => {
      const line = await GetEntityDetails("line", entityId);
      setMeta({ UpdatedAt: line.UpdatedAt, UpdatedBy: line.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      setDraftAvailable(Object.keys(json).length > 0);
      form.reset({
        Name: json.Name ?? line.Name ?? "",
        Comment: json.Comment ?? line.Comment ?? "",
        StatusColor: json.StatusColor ?? line.StatusColor ?? "empty",
        AssemblyArea: json.AssemblyArea ?? line.AssemblyArea ?? "",
      });

      setFormReady(true);
      setVersions(await GetEntityVersions("line", entityId));
      queryClient.invalidateQueries({
        queryKey: ["line", entityId],
      });
    })();
  }, [observer, dbState, i18n.language]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    AssemblyArea: z
      .string()
      .max(3, { message: t("AssemblyArea ValidationFailed") })
      .optional(),
  });

  function clearDrafts() {
    localStorage.removeItem(entityId);
    setObserver((prev) => prev + 1);
  }

  const queryClient = useQueryClient();

  const { data: line } = useQuery({
    queryKey: ["line", entityId],
    queryFn: async () => {
      const values = form.getValues();
      const res: Record<string, any> = {};
      setDraftAvailable(
        Object.keys(JSON.parse(localStorage.getItem(entityId) ?? "{}")).length >
          0
      );
      Object.entries(values).forEach(([key, value]) => {
        JSON.parse(localStorage.getItem(entityId) ?? "{}")[key] != null
          ? (res[key] = { data: value, draft: true })
          : { data: value, draft: false };
      });
      return res;
    },
    enabled: formReady,
  });

  const { data: lineDb } = useQuery({
    queryKey: ["lineDb", entityId],
    queryFn: async () => await GetEntityDetails("line", entityId),
  });

  const { mutate: discardDrafts } = useMutation({
    mutationFn: async () => {
      await clearDrafts();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["line", entityId],
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { mutate: submitForm } = useMutation({
    mutationFn: async () => {
      await onSubmit();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries();
    },
  });

  async function onSubmit() {
    let changesRecord: Record<string, string> = {};

    const lineDb = await GetEntityDetails("line", entityId);
    if (!line) return;
    Object.entries(line).forEach(([key, value]) => {
      if (value.draft && lineDb.key != value.data) {
        changesRecord[key] = value.data;
      }
    });

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "line",
      entityId,
      lastUpdate ?? "",
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("line") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  return formReady ? (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-3 flex flex-col gap-5"
      >
        <div>
          {versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex gap-3 items-center w-fit px-2.5"
                >
                  <History />
                  <span className="font-semibold">{t("VersionHistory")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-0">
                <DropdownMenuItem className="p-0 m-0">
                  <ScrollArea className="p-1">
                    <div className="max-h-[30vh]">
                      {versions.map((version) => (
                        <div key={version.EntityID + version.Version}>
                          <Button
                            variant="ghost"
                            className="w-full h-fit justify-start"
                            onClick={() => {
                              setSelectedVersion(version);
                              setVersionDialogOpen(true);
                            }}
                          >
                            <span className="max-w-sm text-wrap break-words text-left">
                              {`${version.Version} ${t("by")} ${
                                version.UpdatedBy
                              } 
                    ${t("on")} ${formatTimestamp(version.UpdatedAt)[0]} 
                    ${t("at")} ${formatTimestamp(version.UpdatedAt)[1]}`}
                            </span>
                          </Button>
                          {version.Version != 1 && (
                            <DropdownMenuSeparator className="bg-accent h-px my-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
            <DialogContent className="py-10 grid grid-cols-1 gap-5 w-1/2">
              <DialogTitle>{t("VersionHistory DialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("VersionHistory DialogDescription", {
                  Version: selectedVersion?.Version,
                  UpdatedBy: selectedVersion?.UpdatedBy,
                  UpdatedAtDate: formatTimestamp(selectedVersion?.UpdatedAt)[0],
                  UpdatedAtTime: formatTimestamp(selectedVersion?.UpdatedAt)[1],
                })}
              </DialogDescription>
              <ScrollArea className="pr-4">
                <div className="flex flex-col gap-3 font-semibold max-h-[50vh] break-words">
                  <span>{`${t("StatusColor")} → ${t(
                    selectedVersion?.StatusColor
                  )}`}</span>
                  <span>{`${t("Comment")} → ${
                    selectedVersion?.Comment ? selectedVersion?.Comment : ""
                  }`}</span>
                  <span>{`${t("Name")} → ${
                    selectedVersion?.Name ? selectedVersion?.Name : ""
                  }`}</span>
                  <span>{`${t("AssemblyArea")} → ${
                    selectedVersion?.AssemblyArea
                      ? selectedVersion?.AssemblyArea
                      : ""
                  }`}</span>
                </div>
              </ScrollArea>
              <Button
                variant="outline"
                className="w-1/2 mx-auto"
                onClick={() => {
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.StatusColor = selectedVersion.StatusColor ?? "";
                  json.Comment = selectedVersion.Comment ?? "";
                  json.Name = selectedVersion.Name ?? "";
                  json.AssemblyArea = selectedVersion.AssemblyArea ?? "";
                  localStorage.setItem(entityId, JSON.stringify(json));
                  setObserver((prev) => prev + 1);
                  toast.success(t("VersionHistory Toast"));
                  setVersionDialogOpen(false);
                }}
              >
                {t("Confirm")}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3 items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommentOpen(commentOpen ? false : true)}
            type="button"
          >
            {commentOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
          <div className="flex gap-3 items-center">
            {line && line.StatusColor?.draft && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SquarePen size={15} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    {t(lineDb.StatusColor)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <FormField
              control={form.control}
              name="StatusColor"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      className="flex gap-1.5"
                      value={field.value ?? "empty"}
                      onValueChange={(value: string) => {
                        field.onChange(value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.StatusColor = value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["line", entityId],
                        });
                      }}
                    >
                      <RadioGroupItem
                        value="empty"
                        aria-label="empty"
                        className="size-6 border bg-background"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        {commentOpen && (
          <div className="flex flex-col gap-3">
            {line && line.Comment?.draft ? (
              <TooltipProvider>
                <Tooltip>
                  <div className="flex gap-3">
                    <FormLabel className="flex h-[15px]">
                      {t("Comment")}
                    </FormLabel>
                    <TooltipTrigger asChild>
                      <SquarePen size={15} />
                    </TooltipTrigger>
                  </div>
                  <TooltipContent className="max-w-sm">
                    {t(lineDb.Comment)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <FormLabel className="flex h-[15px]">{t("Comment")}</FormLabel>
            )}

            <FormField
              control={form.control}
              name="Comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.Comment = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["line", entityId],
                        });
                      }}
                      className="h-32 resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="Name"
          render={({ field }) => (
            <FormItem>
              {line && line.Name?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Name")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(lineDb.Name)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">{t("Name")}</FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Name = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["line", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="AssemblyArea"
          render={({ field }) => (
            <FormItem>
              {line && line.AssemblyArea?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("AssemblyArea")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(lineDb.AssemblyArea)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("AssemblyArea")}
                </FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.AssemblyArea = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["line", entityId],
                    });
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {draftAvailable && (
          <div className="flex gap-5 justify-center">
            <Button
              variant="outline"
              type="button"
              onClick={async () => discardDrafts()}
              className="w-full"
            >
              {t("Discard")}
            </Button>
            <Button variant="outline" type="submit" className="w-full">
              {t("Submit")}
            </Button>
          </div>
        )}
        <div className="flex justify-center items-center">
          <div className="max-w-80 text-left italic text-sm">
            {t("EntityMetaData", {
              name: meta?.UpdatedBy,
              date: formatTimestamp(meta.UpdatedAt ?? "")[0],
              time: formatTimestamp(meta.UpdatedAt ?? "")[1],
            })}
          </div>
        </div>
      </form>
    </Form>
  ) : showSkeletons ? (
    <div className="flex flex-col gap-5 py-5">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="w-full h-10" />
      ))}
    </div>
  ) : null;
}

export function StationForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState, lastUpdate } = useContext();
  const { t, i18n } = useTranslation();
  const [draftAvailable, setDraftAvailable] = useState(false);

  // Use delayed loading to prevent skeleton flickering
  const showSkeletons = useDelayedLoading(!formReady);

  useEffect(() => {
    (async () => {
      const station = await GetEntityDetails("station", entityId);
      setMeta({ UpdatedAt: station.UpdatedAt, UpdatedBy: station.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      setDraftAvailable(Object.keys(json).length > 0);
      form.reset({
        Name: json.Name ?? station.Name ?? "",
        Comment: json.Comment ?? station.Comment ?? "",
        StatusColor: json.StatusColor ?? station.StatusColor ?? "empty",
        Description: json.Description ?? station.Description ?? "",
        StationType: json.StationType ?? station.StationType ?? "",
      });

      setFormReady(true);
      setVersions(await GetEntityVersions("station", entityId));
      queryClient.invalidateQueries({
        queryKey: ["station", entityId],
      });
    })();
  }, [observer, dbState, i18n.language]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
    StationType: z.string().optional(),
  });

  function clearDrafts() {
    localStorage.removeItem(entityId);
    setObserver((prev) => prev + 1);
  }

  const queryClient = useQueryClient();

  const { data: station } = useQuery({
    queryKey: ["station", entityId],
    queryFn: async () => {
      setDraftAvailable(
        Object.keys(JSON.parse(localStorage.getItem(entityId) ?? "{}")).length >
          0
      );
      const values = form.getValues();
      const res: Record<string, any> = {};
      Object.entries(values).forEach(([key, value]) => {
        JSON.parse(localStorage.getItem(entityId) ?? "{}")[key] != null
          ? (res[key] = { data: value, draft: true })
          : { data: value, draft: false };
      });
      return res;
    },
    enabled: formReady,
  });

  const { data: stationDb } = useQuery({
    queryKey: ["stationDb", entityId],
    queryFn: async () => await GetEntityDetails("station", entityId),
  });

  const { mutate: discardDrafts } = useMutation({
    mutationFn: async () => {
      await clearDrafts();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["station", entityId],
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { mutate: submitForm } = useMutation({
    mutationFn: async () => {
      await onSubmit();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries();
    },
  });

  async function onSubmit() {
    let changesRecord: Record<string, string> = {};

    let resetChildTemplate = false;
    const stationDb = await GetEntityDetails("station", entityId);
    if (!station) return;
    Object.entries(station).forEach(([key, value]) => {
      if (value.draft && stationDb.key != value.data) {
        if (
          key == "StationType" &&
          (value.data == "" || value.data == "none" || value.data == "0")
        )
          resetChildTemplate = true;
        changesRecord[key] = value.data;
      }
    });

    if (resetChildTemplate) {
      const tools = await GetAllEntities("tool", entityId);
      if (tools)
        tools.forEach(async ({ ID }) => {
          const operations = await GetAllEntities("operation", ID);
          operations.forEach(async ({ ID }) => {
            UpdateEntityFieldsString(
              String(localStorage.getItem("name")),
              "operation",
              ID,
              lastUpdate ?? "",
              {
                SerialOrParallel: "none",
                SequenceGroup: "",
                Sequence: "",
                GroupID: "",
              }
            );
            const json = JSON.parse(localStorage.getItem(ID) ?? "{}");

            delete json.SerialOrParallel;
            if (JSON.stringify(json) != "{}") {
              localStorage.setItem(ID, JSON.stringify(json));
            }
          });
        });
    }

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "station",
      entityId,
      lastUpdate ?? "",
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("station") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  return formReady ? (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-3  flex flex-col gap-5"
      >
        <div>
          {versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex gap-3 items-center w-fit px-2.5"
                >
                  <History />
                  <span className="font-semibold">{t("VersionHistory")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-0">
                <DropdownMenuItem className="p-0 m-0">
                  <ScrollArea className="p-1">
                    <div className="max-h-[30vh]">
                      {versions.map((version) => (
                        <div key={version.EntityID + version.Version}>
                          <Button
                            variant="ghost"
                            className="w-full h-fit justify-start"
                            onClick={() => {
                              setSelectedVersion(version);
                              setVersionDialogOpen(true);
                            }}
                          >
                            <span className="max-w-sm text-wrap break-words text-left">
                              {`${version.Version} ${t("by")} ${
                                version.UpdatedBy
                              } 
                    ${t("on")} ${formatTimestamp(version.UpdatedAt)[0]} 
                    ${t("at")} ${formatTimestamp(version.UpdatedAt)[1]}`}
                            </span>
                          </Button>
                          {version.Version != 1 && (
                            <DropdownMenuSeparator className="bg-accent h-px my-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
            <DialogContent className="py-10 grid grid-cols-1 gap-5 w-1/2">
              <DialogTitle>{t("VersionHistory DialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("VersionHistory DialogDescription", {
                  Version: selectedVersion?.Version,
                  UpdatedBy: selectedVersion?.UpdatedBy,
                  UpdatedAtDate: formatTimestamp(selectedVersion?.UpdatedAt)[0],
                  UpdatedAtTime: formatTimestamp(selectedVersion?.UpdatedAt)[1],
                })}
              </DialogDescription>
              <ScrollArea className="pr-4">
                <div className="flex flex-col gap-3 font-semibold max-h-[50vh] break-words">
                  <span>{`${t("StatusColor")} → ${t(
                    selectedVersion?.StatusColor
                  )}`}</span>
                  <span>{`${t("Comment")} → ${
                    selectedVersion?.Comment ? selectedVersion?.Comment : ""
                  }`}</span>
                  <span>{`${t("Name")} → ${
                    selectedVersion?.Name ? selectedVersion?.Name : ""
                  }`}</span>
                  <span>{`${t("Description")} → ${
                    selectedVersion?.Description
                      ? selectedVersion?.Description
                      : ""
                  }`}</span>
                  <span>{`${t("StationType")} → ${
                    selectedVersion?.StationType &&
                    selectedVersion?.StationType != "none"
                      ? t("ST_" + selectedVersion?.StationType + "_Name")
                      : ""
                  }`}</span>
                </div>
              </ScrollArea>
              <Button
                variant="outline"
                className="w-1/2 mx-auto"
                onClick={() => {
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.StatusColor = selectedVersion.StatusColor ?? "";
                  json.Comment = selectedVersion.Comment ?? "";
                  json.Name = selectedVersion.Name ?? "";
                  json.Description = selectedVersion.Description ?? "";
                  json.StationType = selectedVersion.StationType ?? "";
                  localStorage.setItem(entityId, JSON.stringify(json));
                  setObserver((prev) => prev + 1);
                  toast.success(t("VersionHistory Toast"));
                  setVersionDialogOpen(false);
                }}
              >
                {t("Confirm")}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3 items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommentOpen(commentOpen ? false : true)}
            type="button"
          >
            {commentOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
          <div className="flex gap-3 items-center">
            {station && station.StatusColor?.draft && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SquarePen size={15} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    {t(stationDb.StatusColor)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <FormField
              control={form.control}
              name="StatusColor"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      className="flex gap-1.5"
                      value={field.value ?? "empty"}
                      onValueChange={(value: string) => {
                        field.onChange(value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.StatusColor = value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["station", entityId],
                        });
                      }}
                    >
                      <RadioGroupItem
                        value="empty"
                        aria-label="empty"
                        className="size-6 border bg-background"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        {commentOpen && (
          <div className="flex flex-col gap-3">
            {station && station.Comment?.draft ? (
              <TooltipProvider>
                <Tooltip>
                  <div className="flex gap-3">
                    <FormLabel className="flex h-[15px]">
                      {t("Comment")}
                    </FormLabel>
                    <TooltipTrigger asChild>
                      <SquarePen size={15} />
                    </TooltipTrigger>
                  </div>
                  <TooltipContent className="max-w-sm">
                    {t(stationDb.Comment)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <FormLabel className="flex h-[15px]">{t("Comment")}</FormLabel>
            )}

            <FormField
              control={form.control}
              name="Comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.Comment = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["station", entityId],
                        });
                      }}
                      className="h-32 resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="Name"
          render={({ field }) => (
            <FormItem>
              {station && station.Name?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Name")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(stationDb.Name)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">{t("Name")}</FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Name = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["station", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="Description"
          render={({ field }) => (
            <FormItem>
              {station && station.Description?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Station Description")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(stationDb.Description)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("Station Description")}
                </FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Description = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["station", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="StationType"
          render={({ field }) => (
            <FormItem>
              {station && station.StationType?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Station Type")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {stationDb.StationType &&
                        t("ST_" + String(stationDb.StationType) + "_Name")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("Station Type")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.StationType = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["station", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("StationType Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.StationTypes.map((stationtype) => {
                    return (
                      <SelectItem
                        key={"ST_" + stationtype.id}
                        value={stationtype.id}
                      >
                        {t("ST_" + String(stationtype.id) + "_Name")}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        {draftAvailable && (
          <div className="flex gap-5 justify-center">
            <Button
              variant="outline"
              type="button"
              onClick={async () => discardDrafts()}
              className="w-full"
            >
              {t("Discard")}
            </Button>
            <Button variant="outline" type="submit" className="w-full">
              {t("Submit")}
            </Button>
          </div>
        )}
        <div className="flex justify-center items-center">
          <div className="max-w-80 text-left italic text-sm">
            {t("EntityMetaData", {
              name: meta?.UpdatedBy,
              date: formatTimestamp(meta.UpdatedAt ?? "")[0],
              time: formatTimestamp(meta.UpdatedAt ?? "")[1],
            })}
          </div>{" "}
        </div>
      </form>
    </Form>
  ) : showSkeletons ? (
    <div className="flex flex-col gap-5 py-5">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="w-full h-10" />
      ))}
    </div>
  ) : null;
}

export function ToolForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState, lastUpdate } = useContext();
  const { t, i18n } = useTranslation();
  const [draftAvailable, setDraftAvailable] = useState(false);

  // Use delayed loading to prevent skeleton flickering
  const showSkeletons = useDelayedLoading(!formReady);

  useEffect(() => {
    (async () => {
      const tool = await GetEntityDetails("tool", entityId);
      setMeta({ UpdatedAt: tool.UpdatedAt, UpdatedBy: tool.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      setDraftAvailable(Object.keys(json).length > 0);
      form.reset({
        Name: json.Name ?? tool.Name ?? "",
        Comment: json.Comment ?? tool.Comment ?? "",
        StatusColor: json.StatusColor ?? tool.StatusColor ?? "empty",
        Description: json.Description ?? tool.Description ?? "",
        IpAddressDevice: json.IpAddressDevice ?? tool.IpAddressDevice ?? "",
        SPSPLCNameSPAService:
          json.SPSPLCNameSPAService ?? tool.SPSPLCNameSPAService ?? "",
        SPSDBNoSend: json.SPSDBNoSend ?? tool.SPSDBNoSend ?? "",
        SPSDBNoReceive: json.SPSDBNoReceive ?? tool.SPSDBNoReceive ?? "",
        SPSPreCheck: json.SPSPreCheck ?? tool.SPSPreCheck ?? "",
        SPSAddressInReceiveDB:
          json.SPSAddressInReceiveDB ?? tool.SPSAddressInReceiveDB ?? "",
        SPSAddressInSendDB:
          json.SPSAddressInSendDB ?? tool.SPSAddressInSendDB ?? "",
        ToolClass: json.ToolClass ?? tool.ToolClass ?? "",
        ToolType: json.ToolType ?? tool.ToolType ?? "",
      });
      setSpsChecked(
        json.SPSPLCNameSPAService ||
          tool.SPSPLCNameSPAService ||
          json.SPSDBNoSend ||
          tool.SPSDBNoSend ||
          json.SPSDBNoReceive ||
          tool.SPSDBNoReceive ||
          json.SPSPreCheck ||
          tool.SPSPreCheck ||
          json.SPSAddressInReceiveDB ||
          tool.SPSAddressInReceiveDB ||
          json.SPSAddressInSendDB ||
          tool.SPSAddressInSendDB
      );

      setFormReady(true);
      setVersions(await GetEntityVersions("tool", entityId));
      queryClient.invalidateQueries({
        queryKey: ["tool", entityId],
      });
    })();
  }, [observer, dbState, i18n.language]);

  function resetSps() {
    const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
    json.SPSPLCNameSPAService = "";
    json.SPSDBNoSend = "";
    json.SPSDBNoReceive = "";
    json.SPSPreCheck = "";
    json.SPSAddressInReceiveDB = "";
    json.SPSAddressInSendDB = "";
    localStorage.setItem(entityId, JSON.stringify(json));
    setObserver((prev) => prev + 1);
  }

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
    IpAddressDevice: z
      .string()
      .optional()
      .refine(
        (ip) =>
          ip === "" ||
          /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            ip ?? ""
          ),
        { message: t("IpAddressDevice ValidationFailed") }
      ),
    SPSPLCNameSPAService: z.string().optional(),
    SPSDBNoSend: z.string().optional(),
    SPSDBNoReceive: z.string().optional(),
    SPSPreCheck: z.string().optional(),
    SPSAddressInReceiveDB: z.string().optional(),
    SPSAddressInSendDB: z.string().optional(),
    ToolClass: z.string().optional(),
    ToolType: z.string().optional(),
  });

  function clearDrafts() {
    localStorage.removeItem(entityId);
    setObserver((prev) => prev + 1);
  }

  const queryClient = useQueryClient();

  const { data: tool } = useQuery({
    queryKey: ["tool", entityId],
    queryFn: async () => {
      setDraftAvailable(
        Object.keys(JSON.parse(localStorage.getItem(entityId) ?? "{}")).length >
          0
      );
      const values = form.getValues();
      const res: Record<string, any> = {};
      Object.entries(values).forEach(([key, value]) => {
        JSON.parse(localStorage.getItem(entityId) ?? "{}")[key] != null
          ? (res[key] = { data: value, draft: true })
          : { data: value, draft: false };
      });
      return res;
    },
    enabled: formReady,
  });

  const { data: toolDb } = useQuery({
    queryKey: ["toolDb", entityId],
    queryFn: async () => await GetEntityDetails("tool", entityId),
  });

  const { mutate: discardDrafts } = useMutation({
    mutationFn: async () => {
      clearDrafts();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["tool", entityId],
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { mutate: submitForm } = useMutation({
    mutationFn: async () => {
      await onSubmit();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries();
    },
  });

  async function onSubmit() {
    let changesRecord: Record<string, string> = {};

    let resetChildTemplate = false;
    const toolDb = await GetEntityDetails("tool", entityId);
    if (!tool) return;
    Object.entries(tool).forEach(([key, value]) => {
      if (value.draft && toolDb.key != value.data) {
        if (key == "ToolClass") resetChildTemplate = true;
        changesRecord[key] = String(value.data);
      }
    });

    if (resetChildTemplate) {
      const operations = await GetAllEntities("operation", entityId);
      if (operations)
        operations.forEach(async ({ ID }) => {
          UpdateEntityFieldsString(
            String(localStorage.getItem("name")),
            "operation",
            ID,
            lastUpdate ?? "",
            {
              Template: "none",
              DecisionClass: "none",
              VerificationClass: "none",
              GenerationClass: "none",
              SavingClass: "none",
            }
          );
          const json = JSON.parse(localStorage.getItem(ID) ?? "{}");

          delete json.Template;
          delete json.DecisionClass;
          delete json.VerificationClass;
          delete json.GenerationClass;
          delete json.SavingClass;
          if (JSON.stringify(json) != "{}") {
            localStorage.setItem(ID, JSON.stringify(json));
          }
        });
    }

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "tool",
      entityId,
      lastUpdate ?? "",
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("tool") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [spsChecked, setSpsChecked] = useState(false);

  return formReady ? (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-3  flex flex-col gap-5"
      >
        <div>
          {versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex gap-3 items-center w-fit px-2.5"
                >
                  <History />
                  <span className="font-semibold">{t("VersionHistory")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-0">
                <DropdownMenuItem className="p-0 m-0">
                  <ScrollArea className="p-1">
                    <div className="max-h-[30vh]">
                      {versions.map((version) => (
                        <div key={version.EntityID + version.Version}>
                          <Button
                            variant="ghost"
                            className="w-full h-fit justify-start"
                            onClick={() => {
                              setSelectedVersion(version);
                              setVersionDialogOpen(true);
                            }}
                          >
                            <span className="max-w-sm text-wrap break-words text-left">
                              {`${version.Version} ${t("by")} ${
                                version.UpdatedBy
                              } 
                    ${t("on")} ${formatTimestamp(version.UpdatedAt)[0]} 
                    ${t("at")} ${formatTimestamp(version.UpdatedAt)[1]}`}
                            </span>
                          </Button>
                          {version.Version != 1 && (
                            <DropdownMenuSeparator className="bg-accent h-px my-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
            <DialogContent className="py-10 grid grid-cols-1 gap-5 w-1/2">
              <DialogTitle>{t("VersionHistory DialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("VersionHistory DialogDescription", {
                  Version: selectedVersion?.Version,
                  UpdatedBy: selectedVersion?.UpdatedBy,
                  UpdatedAtDate: formatTimestamp(selectedVersion?.UpdatedAt)[0],
                  UpdatedAtTime: formatTimestamp(selectedVersion?.UpdatedAt)[1],
                })}
              </DialogDescription>
              <ScrollArea className="pr-4">
                <div className="flex flex-col gap-3 font-semibold max-h-[50vh] break-words">
                  <span>{`${t("StatusColor")} → ${t(
                    selectedVersion?.StatusColor
                  )}`}</span>
                  <span>{`${t("Comment")} → ${t(
                    selectedVersion?.Comment
                  )}`}</span>
                  <span>{`${t("Name")} → ${t(selectedVersion?.Name)}`}</span>
                  <span>{`${t("Description")} → ${t(
                    selectedVersion?.Description
                  )}`}</span>
                  <span>{`${t("ToolClass")} → ${
                    selectedVersion?.ToolClass &&
                    selectedVersion?.ToolClass != "none"
                      ? t("TC_" + selectedVersion?.ToolClass + "_ToolClassName")
                      : ""
                  }`}</span>
                  <span>{`${t("ToolType")} → ${
                    selectedVersion?.ToolType &&
                    selectedVersion?.ToolClass &&
                    selectedVersion?.ToolType != "none" &&
                    selectedVersion?.ToolClass != "none"
                      ? t(
                          "TT_" +
                            selectedVersion?.ToolType +
                            "_" +
                            selectedVersion?.ToolClass +
                            "_Description"
                        )
                      : ""
                  }`}</span>
                  <span>{`${t("IpAddressDevice")} → ${
                    selectedVersion?.IpAddressDevice
                      ? selectedVersion?.IpAddressDevice
                      : ""
                  }`}</span>
                  <span>{`${t("SPSPLCNameSPAService")} → ${
                    selectedVersion?.SPSPLCNameSPAService
                      ? selectedVersion?.SPSPLCNameSPAService
                      : ""
                  }`}</span>
                  <span>{`${t("SPSDBNoSend")} → ${
                    selectedVersion?.SPSDBNoSend
                      ? selectedVersion?.SPSDBNoSend
                      : ""
                  }`}</span>
                  <span>{`${t("SPSDBNoReceive")} → ${
                    selectedVersion?.SPSDBNoReceive
                      ? selectedVersion?.SPSDBNoReceive
                      : ""
                  }`}</span>
                  <span>{`${t("SPSPreCheck")} → ${
                    selectedVersion?.SPSPreCheck
                      ? selectedVersion?.SPSPreCheck
                      : ""
                  }`}</span>
                  <span>{`${t("SPSAddressInSendDB")} → ${
                    selectedVersion?.SPSAddressInSendDB
                      ? selectedVersion?.SPSAddressInSendDB
                      : ""
                  }`}</span>
                  <span>{`${t("SPSAddressInReceiveDB")} → ${
                    selectedVersion?.SPSAddressInReceiveDB
                      ? selectedVersion?.SPSAddressInReceiveDB
                      : ""
                  }`}</span>
                </div>
              </ScrollArea>
              <Button
                variant="outline"
                className="w-1/2 mx-auto"
                onClick={() => {
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.StatusColor = selectedVersion.StatusColor ?? "";
                  json.Comment = selectedVersion.Comment ?? "";
                  json.Name = selectedVersion.Name ?? "";
                  json.Description = selectedVersion.Description ?? "";
                  json.ToolClass = selectedVersion.ToolClass ?? "";
                  json.ToolType = selectedVersion.ToolType ?? "";
                  json.IpAddressDevice = selectedVersion.IpAddressDevice ?? "";
                  json.SPSPLCNameSPAService =
                    selectedVersion.SPSPLCNameSPAService ?? "";
                  json.SPSDBNoSend = selectedVersion.SPSDBNoSend ?? "";
                  json.SPSDBNoReceive = selectedVersion.SPSDBNoReceive ?? "";
                  json.SPSPreCheck = selectedVersion.SPSPreCheck ?? "";
                  json.SPSAddressInSendDB =
                    selectedVersion.SPSAddressInSendDB ?? "";
                  json.SPSAddressInReceiveDB =
                    selectedVersion.SPSAddressInReceiveDB ?? "";
                  localStorage.setItem(entityId, JSON.stringify(json));
                  setObserver((prev) => prev + 1);
                  toast.success(t("VersionHistory Toast"));
                  setVersionDialogOpen(false);
                }}
              >
                {t("Confirm")}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3 items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommentOpen(commentOpen ? false : true)}
            type="button"
          >
            {commentOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
          <div className="flex gap-3 items-center">
            {tool && tool.StatusColor?.draft && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SquarePen size={15} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    {t(toolDb.StatusColor)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <FormField
              control={form.control}
              name="StatusColor"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      className="flex gap-1.5"
                      value={field.value ?? "empty"}
                      onValueChange={(value: string) => {
                        field.onChange(value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.StatusColor = value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    >
                      <RadioGroupItem
                        value="empty"
                        aria-label="empty"
                        className="size-6 border bg-background"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        {commentOpen && (
          <div className="flex flex-col gap-3">
            {tool && tool.Comment?.draft ? (
              <TooltipProvider>
                <Tooltip>
                  <div className="flex gap-3">
                    <FormLabel className="flex h-[15px]">
                      {t("Comment")}
                    </FormLabel>
                    <TooltipTrigger asChild>
                      <SquarePen size={15} />
                    </TooltipTrigger>
                  </div>
                  <TooltipContent className="max-w-sm">
                    {t(toolDb.Comment)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <FormLabel className="flex h-[15px]">{t("Comment")}</FormLabel>
            )}

            <FormField
              control={form.control}
              name="Comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.Comment = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                      className="h-32 resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="Name"
          render={({ field }) => (
            <FormItem>
              {tool && tool.Name?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Name")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(toolDb.Name)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">{t("Name")}</FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Name = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["tool", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="Description"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-3">
                {tool && tool.Description?.draft ? (
                  <TooltipProvider>
                    <Tooltip>
                      <div className="flex gap-3">
                        <FormLabel className="flex h-[15px]">
                          {t("Operation Description")}
                        </FormLabel>
                        <TooltipTrigger asChild>
                          <SquarePen size={15} />
                        </TooltipTrigger>
                      </div>
                      <TooltipContent className="max-w-sm">
                        {t(toolDb.Description)}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <FormLabel className="flex h-[15px]">
                    {t("Operation Description")}
                  </FormLabel>
                )}
              </div>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Description = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["tool", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ToolClass"
          render={({ field }) => (
            <FormItem>
              {tool && tool.ToolClass?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("ToolClass")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {toolDb.ToolClass &&
                        t("TC_" + String(toolDb.ToolClass) + "_ToolClassName")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("ToolClass")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.ToolClass = value;

                  if (value == "none" || value == "") {
                    json.ToolType = value;
                    setObserver((prev) => prev + 1);
                  }

                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["tool", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("ToolClass Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.ToolClasses.map((toolclass) => {
                    let skip = true;
                    toolclass.toolTypeIds.every((tt) => {
                      if (
                        !form.getValues().ToolType ||
                        form.getValues().ToolType == "none"
                      ) {
                        skip = false;
                        return false;
                      } else if (form.getValues().ToolType == tt) {
                        skip = false;
                        return false;
                      }
                      return true;
                    });

                    return (
                      !skip && (
                        <SelectItem
                          key={"TC_" + toolclass.id}
                          value={toolclass.id}
                        >
                          {t("TC_" + String(toolclass.id) + "_ToolClassName")}
                        </SelectItem>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ToolType"
          render={({ field }) => (
            <FormItem>
              {tool && tool.ToolType?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("ToolType")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {toolDb.ToolType &&
                        t(
                          "TT_" +
                            String(toolDb.ToolType) +
                            "_" +
                            String(toolDb.ToolClass) +
                            "_Description"
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">{t("ToolType")}</FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.ToolType = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["tool", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("ToolType Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.ToolTypes.map(
                    (tooltype) =>
                      form.getValues().ToolClass == tooltype.toolClassId && (
                        <TooltipProvider key={"TT_" + tooltype.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectItem
                                key={"TT_" + tooltype.id}
                                value={tooltype.id}
                              >
                                {t(
                                  "TT_" +
                                    String(tooltype.id) +
                                    "_" +
                                    String(tooltype.toolClassId) +
                                    "_Description"
                                )}
                              </SelectItem>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {t(
                                "TT_" +
                                  String(tooltype.id) +
                                  "_" +
                                  String(tooltype.toolClassId) +
                                  "_HelpText"
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                  )}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="IpAddressDevice"
          render={({ field }) => (
            <FormItem>
              {tool && tool.IpAddressDevice?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("IpAddressDevice")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(toolDb.IpAddressDevice)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("IpAddressDevice")}
                </FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.IpAddressDevice = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["tool", entityId],
                    });
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-row items-center gap-2 rounded-md pl-4 border h-10">
          <Checkbox
            checked={!!spsChecked}
            onClick={async () => (
              spsChecked && resetSps(), setSpsChecked((checked) => !checked)
            )}
          />
          <FormLabel
            className="hover:cursor-pointer"
            onClick={async () => (
              spsChecked && resetSps(), setSpsChecked((checked) => !checked)
            )}
          >
            {t("ToolWithSPS")}
          </FormLabel>
        </div>
        {spsChecked && (
          <>
            <FormField
              control={form.control}
              name="SPSPLCNameSPAService"
              render={({ field }) => (
                <FormItem>
                  {tool && tool.SPSPLCNameSPAService?.draft ? (
                    <TooltipProvider>
                      <Tooltip>
                        <div className="flex gap-3">
                          <FormLabel className="flex h-[15px]">
                            {t("SPSPLCNameSPAService")}
                          </FormLabel>
                          <TooltipTrigger asChild>
                            <SquarePen size={15} />
                          </TooltipTrigger>
                        </div>
                        <TooltipContent className="max-w-sm">
                          {t(toolDb.SPSPLCNameSPAService)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <FormLabel className="flex h-[15px]">
                      {t("SPSPLCNameSPAService")}
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.SPSPLCNameSPAService = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="SPSDBNoSend"
              render={({ field }) => (
                <FormItem>
                  {tool && tool.SPSDBNoSend?.draft ? (
                    <TooltipProvider>
                      <Tooltip>
                        <div className="flex gap-3">
                          <FormLabel className="flex h-[15px]">
                            {t("SPSDBNoSend")}
                          </FormLabel>
                          <TooltipTrigger asChild>
                            <SquarePen size={15} />
                          </TooltipTrigger>
                        </div>
                        <TooltipContent className="max-w-sm">
                          {t(toolDb.SPSDBNoSend)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <FormLabel className="flex h-[15px]">
                      {t("SPSDBNoSend")}
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.SPSDBNoSend = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="SPSDBNoReceive"
              render={({ field }) => (
                <FormItem>
                  {tool && tool.SPSDBNoReceive?.draft ? (
                    <TooltipProvider>
                      <Tooltip>
                        <div className="flex gap-3">
                          <FormLabel className="flex h-[15px]">
                            {t("SPSDBNoReceive")}
                          </FormLabel>
                          <TooltipTrigger asChild>
                            <SquarePen size={15} />
                          </TooltipTrigger>
                        </div>
                        <TooltipContent className="max-w-sm">
                          {t(toolDb.SPSDBNoReceive)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <FormLabel className="flex h-[15px]">
                      {t("SPSDBNoReceive")}
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.SPSDBNoReceive = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="SPSPreCheck"
              render={({ field }) => (
                <FormItem>
                  {tool && tool.SPSPreCheck?.draft ? (
                    <TooltipProvider>
                      <Tooltip>
                        <div className="flex gap-3">
                          <FormLabel className="flex h-[15px]">
                            {t("SPSPreCheck")}
                          </FormLabel>
                          <TooltipTrigger asChild>
                            <SquarePen size={15} />
                          </TooltipTrigger>
                        </div>
                        <TooltipContent className="max-w-sm">
                          {t(toolDb.SPSPreCheck)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <FormLabel className="flex h-[15px]">
                      {t("SPSPreCheck")}
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.SPSPreCheck = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="SPSAddressInSendDB"
              render={({ field }) => (
                <FormItem>
                  {tool && tool.SPSAddressInSendDB?.draft ? (
                    <TooltipProvider>
                      <Tooltip>
                        <div className="flex gap-3">
                          <FormLabel className="flex h-[15px]">
                            {t("SPSAddressInSendDB")}
                          </FormLabel>
                          <TooltipTrigger asChild>
                            <SquarePen size={15} />
                          </TooltipTrigger>
                        </div>
                        <TooltipContent className="max-w-sm">
                          {t(toolDb.SPSAddressInSendDB)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <FormLabel className="flex h-[15px]">
                      {t("SPSAddressInSendDB")}
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.SPSAddressInSendDB = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="SPSAddressInReceiveDB"
              render={({ field }) => (
                <FormItem>
                  {tool && tool.SPSAddressInReceiveDB?.draft ? (
                    <TooltipProvider>
                      <Tooltip>
                        <div className="flex gap-3">
                          <FormLabel className="flex h-[15px]">
                            {t("SPSAddressInReceiveDB")}
                          </FormLabel>
                          <TooltipTrigger asChild>
                            <SquarePen size={15} />
                          </TooltipTrigger>
                        </div>
                        <TooltipContent className="max-w-sm">
                          {t(toolDb.SPSAddressInReceiveDB)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <FormLabel className="flex h-[15px]">
                      {t("SPSAddressInReceiveDB")}
                    </FormLabel>
                  )}
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.SPSAddressInReceiveDB = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["tool", entityId],
                        });
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}
        {draftAvailable && (
          <div className="flex gap-5 justify-center">
            <Button
              variant="outline"
              type="button"
              onClick={async () => discardDrafts()}
              className="w-full"
            >
              {t("Discard")}
            </Button>
            <Button variant="outline" type="submit" className="w-full">
              {t("Submit")}
            </Button>
          </div>
        )}
        <div className="flex justify-center items-center">
          <div className="max-w-80 text-left italic text-sm">
            {t("EntityMetaData", {
              name: meta?.UpdatedBy,
              date: formatTimestamp(meta.UpdatedAt ?? "")[0],
              time: formatTimestamp(meta.UpdatedAt ?? "")[1],
            })}
          </div>
        </div>
      </form>
    </Form>
  ) : showSkeletons ? (
    <div className="flex flex-col gap-5 py-5">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="w-full h-10" />
      ))}
    </div>
  ) : null;
}

export function OperationForm({
  entityId,
  suuid,
}: {
  entityId: string;
  suuid: string;
}) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState, lastUpdate } = useContext();
  const { t, i18n } = useTranslation();
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [parentTool, setParentTool] = useState<any>();

  // Use delayed loading to prevent skeleton flickering
  const showSkeletons = useDelayedLoading(!formReady);

  useEffect(() => {
    (async () => {
      const operation = await GetEntityDetails("operation", entityId);
      const station = await GetEntityDetails("station", suuid);
      const parentId = operation.ParentID;
      setParentTool(await GetEntityDetails("tool", parentId));

      setMeta({
        UpdatedAt: operation.UpdatedAt,
        UpdatedBy: operation.UpdatedBy,
      });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      setDraftAvailable(Object.keys(json).length > 0);
      const jsonDecisionCriteria = json.DecisionCriteria
        ? Array.isArray(json.DecisionCriteria)
          ? json.DecisionCriteria
          : json.DecisionCriteria.split("<|||>")
        : null;
      const operationDecisionCriteria =
        operation.DecisionCriteria && operation.DecisionCriteria.split("<|||>");

      form.reset({
        Name: json.Name ?? operation.Name ?? "",
        Comment: json.Comment ?? operation.Comment ?? "",
        StatusColor: json.StatusColor ?? operation.StatusColor ?? "empty",
        Description: json.Description ?? operation.Description ?? "",
        StationType: station.StationType ?? "",
        SerialOrParallel:
          json.SerialOrParallel ?? operation.SerialOrParallel ?? "",
        AlwaysPerform: json.AlwaysPerform ?? operation.AlwaysPerform ?? "",
        QGateRelevant: json.QGateRelevant ?? operation.QGateRelevant ?? "",
        Template: json.Template ?? operation.Template ?? "",
        DecisionClass: json.DecisionClass ?? operation.DecisionClass ?? "",
        VerificationClass:
          json.VerificationClass ?? operation.VerificationClass ?? "",
        GenerationClass:
          json.GenerationClass ?? operation.GenerationClass ?? "",
        SavingClass: json.SavingClass ?? operation.SavingClass ?? "",
        DecisionCriteria:
          jsonDecisionCriteria ?? operationDecisionCriteria ?? [],
      });

      setFormReady(true);
      setVersions(await GetEntityVersions("operation", entityId));
      queryClient.invalidateQueries({
        queryKey: ["operation", entityId],
      });
    })();
  }, [observer, dbState, i18n]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
    StationType: z.string().optional(),
    SerialOrParallel: z.string().optional(),
    AlwaysPerform: z.string().optional(),
    QGateRelevant: z.string().optional(),
    Template: z.string().optional(),
    DecisionClass: z.string().optional(),
    VerificationClass: z.string().optional(),
    GenerationClass: z.string().optional(),
    SavingClass: z.string().optional(),
    DecisionCriteria: z.array(z.string()).optional(),
  });
  function clearDrafts() {
    localStorage.removeItem(entityId);
    setObserver((prev) => prev + 1);
  }

  const queryClient = useQueryClient();

  const { data: operation } = useQuery({
    queryKey: ["operation", entityId],
    queryFn: async () => {
      setDraftAvailable(
        Object.keys(JSON.parse(localStorage.getItem(entityId) ?? "{}")).length >
          0
      );
      const values = form.getValues();
      const res: Record<string, any> = {};
      Object.entries(values).forEach(([key, value]) => {
        JSON.parse(localStorage.getItem(entityId) ?? "{}")[key] != null
          ? (res[key] = { data: value, draft: true })
          : { data: value, draft: false };
      });
      return res;
    },
    enabled: formReady,
  });

  const { data: operationDb } = useQuery({
    queryKey: ["operationDb", entityId],
    queryFn: async () => await GetEntityDetails("operation", entityId),
  });

  const { mutate: discardDrafts } = useMutation({
    mutationFn: async () => {
      clearDrafts();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({
        queryKey: ["operation", entityId],
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const { mutate: submitForm } = useMutation({
    mutationFn: async () => {
      await onSubmit();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries();
    },
  });

  async function onSubmit() {
    let changesRecord: Record<string, string> = {};

    const operationDb = await GetEntityDetails("operation", entityId);
    if (!operation) return;
    Object.entries(operation).forEach(([key, value]) => {
      if (value.draft && operationDb.key != value.data) {
        if (key == "DecisionCriteria") {
          changesRecord[key] = value.data.join("<|||>");
          return;
        } else if (key == "SerialOrParallel") {
          changesRecord["Sequence"] = "";
          changesRecord["SequenceGroup"] = "";
          changesRecord["GroupID"] = "";
          changesRecord[key] = value.data;
          return;
        }
        changesRecord[key] = value.data;
      }
    });

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "operation",
      entityId,
      lastUpdate ?? "",
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("operation") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);

  return formReady ? (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-3  flex flex-col gap-5"
      >
        <div>
          {versions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex gap-3 items-center w-fit px-2.5"
                >
                  <History />
                  <span className="font-semibold">{t("VersionHistory")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-0">
                <DropdownMenuItem className="p-0 m-0">
                  <ScrollArea className="p-1">
                    <div className="max-h-[30vh]">
                      {versions.map((version) => (
                        <div key={version.EntityID + version.Version}>
                          <Button
                            variant="ghost"
                            className="w-full h-fit justify-start"
                            onClick={() => {
                              setSelectedVersion(version);
                              setVersionDialogOpen(true);
                            }}
                          >
                            <span className="max-w-sm text-wrap break-words text-left">
                              {`${version.Version} ${t("by")} ${
                                version.UpdatedBy
                              } 
                    ${t("on")} ${formatTimestamp(version.UpdatedAt)[0]} 
                    ${t("at")} ${formatTimestamp(version.UpdatedAt)[1]}`}
                            </span>
                          </Button>
                          {version.Version != 1 && (
                            <DropdownMenuSeparator className="bg-accent h-px my-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
            <DialogContent className="py-10 grid grid-cols-1 gap-5 w-1/2">
              <DialogTitle>{t("VersionHistory DialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("VersionHistory DialogDescription", {
                  Version: selectedVersion?.Version,
                  UpdatedBy: selectedVersion?.UpdatedBy,
                  UpdatedAtDate: formatTimestamp(selectedVersion?.UpdatedAt)[0],
                  UpdatedAtTime: formatTimestamp(selectedVersion?.UpdatedAt)[1],
                })}
              </DialogDescription>
              <ScrollArea className="pr-4">
                <div className="flex flex-col gap-3 font-semibold max-h-[50vh] break-words">
                  <span>{`${t("StatusColor")} → ${t(
                    selectedVersion?.StatusColor
                  )}`}</span>
                  <span>{`${t("Comment")} → ${
                    selectedVersion?.Comment ? selectedVersion?.Comment : ""
                  }`}</span>
                  <span>{`${t("Name")} → ${
                    selectedVersion?.Name ? selectedVersion?.Name : ""
                  }`}</span>
                  <span>{`${t("Description")} → ${
                    selectedVersion?.Description
                      ? selectedVersion?.Description
                      : ""
                  }`}</span>
                  <span>{`${t("SerialOrParallel")} → ${
                    selectedVersion?.SerialOrParallel &&
                    selectedVersion?.SerialOrParallel != "none"
                      ? t("SOP_" + selectedVersion?.SerialOrParallel + "_name")
                      : ""
                  }`}</span>
                  <span>{`${t("AlwaysPerform")} → ${t(
                    selectedVersion?.AlwaysPerform
                  )}`}</span>
                  <span>{`${t("QGateRelevant")} → ${
                    selectedVersion?.QGateRelevant &&
                    selectedVersion?.QGateRelevant != "none"
                      ? t("QR_" + selectedVersion?.QGateRelevant + "_name")
                      : ""
                  }`}</span>
                  <span>{`${t("Template")} → ${
                    selectedVersion?.Template &&
                    selectedVersion?.Template != "none"
                      ? t("T_" + selectedVersion?.Template + "_Description")
                      : ""
                  }`}</span>
                  <span>{`${t("DecisionClass")} → ${
                    selectedVersion?.DecisionClass &&
                    selectedVersion?.DecisionClass != "none"
                      ? t(
                          "OC_DECISION_" +
                            selectedVersion?.DecisionClass +
                            "_ClassDescription"
                        )
                      : ""
                  }`}</span>
                  <span>{`${t("VerificationClass")} → ${
                    selectedVersion?.VerificationClass &&
                    selectedVersion?.VerificationClass != "none"
                      ? t(
                          "OC_VERIFICATION_" +
                            selectedVersion?.VerificationClass +
                            "_" +
                            selectedVersion?.Template +
                            "_ClassDescription"
                        )
                      : ""
                  }`}</span>
                  <span>{`${t("GenerationClass")} → ${
                    selectedVersion?.GenerationClass &&
                    selectedVersion?.GenerationClass != "none"
                      ? t(
                          "OC_GENERATION_" +
                            selectedVersion?.GenerationClass +
                            "_" +
                            selectedVersion?.Template +
                            "_ClassDescription"
                        )
                      : ""
                  }`}</span>
                  <span>{`${t("SavingClass")} → ${
                    selectedVersion?.SavingClass &&
                    selectedVersion?.SavingClass != "none"
                      ? t(
                          "OC_SAVING_" +
                            selectedVersion?.SavingClass +
                            "_" +
                            selectedVersion?.Template +
                            "_ClassDescription"
                        )
                      : ""
                  }`}</span>
                  <span>{`${t("DecisionCriteria")} → ${
                    selectedVersion?.DecisionCriteria
                      ? String(selectedVersion?.DecisionCriteria)
                          .split("<|||>")
                          .join("; ")
                      : ""
                  }`}</span>
                </div>
              </ScrollArea>
              <Button
                variant="outline"
                className="w-1/2 mx-auto"
                onClick={() => {
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.StatusColor = selectedVersion.StatusColor ?? "";
                  json.Comment = selectedVersion.Comment ?? "";
                  json.Name = selectedVersion.Name ?? "";
                  json.Description = selectedVersion.Description ?? "";
                  json.SerialOrParallel =
                    selectedVersion.SerialOrParallel ?? "";
                  json.AlwaysPerform = selectedVersion.AlwaysPerform ?? "";
                  json.QGateRelevant = selectedVersion.QGateRelevant ?? "";
                  json.Template = selectedVersion.Template ?? "";
                  json.DecisionClass = selectedVersion.DecisionClass ?? "";
                  json.SavingClass = selectedVersion.SavingClass ?? "";
                  json.VerificationClass =
                    selectedVersion.VerificationClass ?? "";
                  json.GenerationClass = selectedVersion.GenerationClass ?? "";
                  json.DecisionCriteria = selectedVersion.DecisionCriteria
                    ? selectedVersion.DecisionCriteria.split("<|||>")
                    : [];
                  localStorage.setItem(entityId, JSON.stringify(json));
                  setObserver((prev) => prev + 1);
                  toast.success(t("VersionHistory Toast"));
                  setVersionDialogOpen(false);
                }}
              >
                {t("Confirm")}
              </Button>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3 items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommentOpen(commentOpen ? false : true)}
            type="button"
          >
            {commentOpen ? <ChevronUp /> : <ChevronDown />}
          </Button>
          <div className="flex gap-3 items-center">
            {operation && operation.StatusColor?.draft && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SquarePen size={15} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    {t(operationDb.StatusColor)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <FormField
              control={form.control}
              name="StatusColor"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      className="flex gap-1.5"
                      value={field.value ?? "empty"}
                      onValueChange={(value: string) => {
                        field.onChange(value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.StatusColor = value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["operation", entityId],
                        });
                      }}
                    >
                      <RadioGroupItem
                        value="empty"
                        aria-label="empty"
                        className="size-6 border bg-background"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
        {commentOpen && (
          <div className="flex flex-col gap-3">
            {operation && operation.Comment?.draft ? (
              <TooltipProvider>
                <Tooltip>
                  <div className="flex gap-3">
                    <FormLabel className="flex h-[15px]">
                      {t("Comment")}
                    </FormLabel>
                    <TooltipTrigger asChild>
                      <SquarePen size={15} />
                    </TooltipTrigger>
                  </div>
                  <TooltipContent className="max-w-sm">
                    {t(operationDb.Comment)}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <FormLabel className="flex h-[15px]">{t("Comment")}</FormLabel>
            )}

            <FormField
              control={form.control}
              name="Comment"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        const json = JSON.parse(
                          localStorage.getItem(entityId) ?? "{}"
                        );
                        json.Comment = e.target.value;
                        localStorage.setItem(entityId, JSON.stringify(json));
                        queryClient.invalidateQueries({
                          queryKey: ["operation", entityId],
                        });
                      }}
                      className="h-32 resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="Name"
          render={({ field }) => (
            <FormItem>
              {operation && operation.Name?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Name")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(operationDb.Name)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">{t("Name")}</FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Name = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["operation", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="Description"
          render={({ field }) => (
            <FormItem>
              {operation && operation.Description?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Operation Description")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(operationDb.Description)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("Operation Description")}
                </FormLabel>
              )}
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Description = e.target.value;
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["operation", entityId],
                    });
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="StationType"
          render={({ field }) => (
            <FormItem className="hidden">
              <FormControl>
                <Input {...field} disabled />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="SerialOrParallel"
          render={({ field }) => (
            <FormItem>
              {operation && operation.SerialOrParallel?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("SerialOrParallel")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.SerialOrParallel &&
                        t(
                          "SOP_" +
                            String(operationDb.SerialOrParallel) +
                            "_name"
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("SerialOrParallel")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.SerialOrParallel = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("SOP Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.SerialOrParallel.map((serialorparallel) => {
                    let skip = true;
                    serialorparallel.stationTypes.every((st) => {
                      if (form.getValues().StationType == st) {
                        skip = false;
                        return false;
                      }
                      return true;
                    });

                    return (
                      !skip && (
                        <SelectItem
                          key={"SOP_" + serialorparallel.id}
                          value={serialorparallel.id}
                        >
                          {t("SOP_" + String(serialorparallel.id) + "_name")}
                        </SelectItem>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="AlwaysPerform"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 rounded-md pl-4 border h-10 space-y-0">
              <FormControl>
                <Checkbox
                  checked={stringToBoolean(field.value)}
                  onCheckedChange={(checked) => {
                    field.onChange(booleanToString(checked as boolean));
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.AlwaysPerform = booleanToString(checked as boolean);
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["operation", entityId],
                    });
                  }}
                />
              </FormControl>
              {operation && operation.AlwaysPerform?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("AlwaysPerform")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {t(operationDb.AlwaysPerform)}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("AlwaysPerform")}
                </FormLabel>
              )}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="QGateRelevant"
          render={({ field }) => (
            <FormItem>
              {operation && operation.QGateRelevant?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("QGateRelevant")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.QGateRelevant &&
                        t("QR_" + String(operationDb.QGateRelevant) + "_name")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("QGateRelevant")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.QGateRelevant = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("QGateRelevant Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.QGateRelevant.map((qgaterelevant) => {
                    return (
                      <SelectItem
                        key={"QR" + qgaterelevant.id}
                        value={qgaterelevant.id}
                      >
                        {t("QR_" + String(qgaterelevant.id) + "_name")}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="Template"
          render={({ field }) => (
            <FormItem>
              {operation && operation.Template?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("Template")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.Template &&
                        t("T_" + String(operationDb.Template) + "_Description")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">{t("Template")}</FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.Template = value;
                  if (value == "none" || value == "") {
                    json.DecisionClass = value;
                    json.VerificationClass = value;
                    json.GenerationClass = value;
                    json.SavingClass = value;
                    setObserver((prev) => prev + 1);
                  }
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Template Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.Templates.map((template) => {
                    let skip = true;
                    template.toolClassesIds.every((tc) => {
                      if (!parentTool?.ToolClass) return false;
                      else if (parentTool?.ToolClass == tc) {
                        skip = false;
                        return false;
                      }
                      return true;
                    });

                    return (
                      !skip && (
                        <SelectItem
                          key={"T_" + template.id}
                          value={template.id}
                        >
                          {t("T_" + String(template.id) + "_Description")}
                        </SelectItem>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="DecisionClass"
          render={({ field }) => (
            <FormItem>
              {operation && operation.DecisionClass?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("DecisionClass")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.DecisionClass &&
                        t(
                          "OC_DECISION_" +
                            String(operationDb.DecisionClass) +
                            "_ClassDescription"
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("DecisionClass")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.DecisionClass = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Decision Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.DecisionClasses.map((decisionclass) => {
                    let skip = true;

                    decisionclass.templateIds.every((t) => {
                      if (form.getValues().Template == t) {
                        skip = false;
                        return false;
                      }
                      return true;
                    });

                    return (
                      !skip && (
                        <TooltipProvider
                          key={"OC_DECISION_" + decisionclass.id}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectItem
                                key={"OC_DECISION_" + decisionclass.id}
                                value={decisionclass.id}
                              >
                                {t(
                                  "OC_DECISION_" +
                                    String(decisionclass.id) +
                                    "_ClassDescription"
                                )}
                              </SelectItem>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {t(
                                "OC_DECISION_" +
                                  String(decisionclass.id) +
                                  "_HelpText"
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="VerificationClass"
          render={({ field }) => (
            <FormItem>
              {operation && operation.VerificationClass?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("VerificationClass")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.VerificationClass &&
                        t(
                          "OC_VERIFICATION_" +
                            String(operationDb.VerificationClass) +
                            "_" +
                            String(operationDb.Template) +
                            "_ClassDescription"
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("VerificationClass")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.VerificationClass = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Verification Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.VerificationClasses.map((verificationclass) => {
                    let skip = true;
                    if (
                      form.getValues().Template == verificationclass.templateId
                    )
                      skip = false;

                    return (
                      !skip && (
                        <TooltipProvider
                          key={"OC_VERIFICATION_" + verificationclass.id}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectItem
                                key={"OC_VERIFICATION_" + verificationclass.id}
                                value={verificationclass.id}
                              >
                                {t(
                                  "OC_VERIFICATION_" +
                                    String(verificationclass.id) +
                                    "_" +
                                    String(verificationclass.templateId) +
                                    "_ClassDescription"
                                )}
                              </SelectItem>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {t(
                                "OC_VERIFICATION_" +
                                  String(verificationclass.id) +
                                  "_" +
                                  String(verificationclass.templateId) +
                                  "_HelpText"
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="GenerationClass"
          render={({ field }) => (
            <FormItem>
              {operation && operation.GenerationClass?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("GenerationClass")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.GenerationClass &&
                        t(
                          "OC_GENERATION_" +
                            String(operationDb.GenerationClass) +
                            "_" +
                            String(operationDb.Template) +
                            "_ClassDescription"
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("GenerationClass")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.GenerationClass = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Generation Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.GenerationClasses.map((generationclass) => {
                    let skip = true;
                    if (form.getValues().Template == generationclass.templateId)
                      skip = false;

                    return (
                      !skip && (
                        <TooltipProvider
                          key={"OC_GENERATION_" + generationclass.id}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectItem
                                key={"OC_GENERATION_" + generationclass.id}
                                value={generationclass.id}
                              >
                                {t(
                                  "OC_GENERATION_" +
                                    String(generationclass.id) +
                                    "_" +
                                    String(generationclass.templateId) +
                                    "_ClassDescription"
                                )}
                              </SelectItem>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {t(
                                "OC_GENERATION_" +
                                  String(generationclass.id) +
                                  "_" +
                                  String(generationclass.templateId) +
                                  "_HelpText"
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="SavingClass"
          render={({ field }) => (
            <FormItem>
              {operation && operation.SavingClass?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("SavingClass")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operation.SavingClass &&
                        t(
                          "OC_SAVING_" +
                            String(operationDb.SavingClass) +
                            "_" +
                            String(operationDb.Template) +
                            "_ClassDescription"
                        )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("SavingClass")}
                </FormLabel>
              )}
              <Select
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.SavingClass = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Saving Placeholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {data.SavingClasses.map((savingclass) => {
                    let skip = true;
                    if (form.getValues().Template == savingclass.templateId)
                      skip = false;

                    return (
                      !skip && (
                        <TooltipProvider key={"OC_SAVING_" + savingclass.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectItem
                                key={"OC_SAVING_" + savingclass.id}
                                value={savingclass.id}
                              >
                                {t(
                                  "OC_SAVING_" +
                                    String(savingclass.id) +
                                    "_" +
                                    String(savingclass.templateId) +
                                    "_ClassDescription"
                                )}
                              </SelectItem>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              {t(
                                "OC_SAVING_" +
                                  String(savingclass.id) +
                                  "_" +
                                  String(savingclass.templateId) +
                                  "_HelpText"
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    );
                  })}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="DecisionCriteria"
          render={({ field }) => (
            <FormItem className="col-span-2">
              {operation && operation.DecisionCriteria?.draft ? (
                <TooltipProvider>
                  <Tooltip>
                    <div className="flex gap-3">
                      <FormLabel className="flex h-[15px]">
                        {t("DecisionCriteria")}
                      </FormLabel>
                      <TooltipTrigger asChild>
                        <SquarePen size={15} />
                      </TooltipTrigger>
                    </div>
                    <TooltipContent className="max-w-sm">
                      {operationDb.DecisionCriteria?.split("<|||>").join("; ")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <FormLabel className="flex h-[15px]">
                  {t("DecisionCriteria")}
                </FormLabel>
              )}
              <FormControl>
                <TagsInput
                  value={field.value ?? []}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.DecisionCriteria = value.join("<|||>");
                    localStorage.setItem(entityId, JSON.stringify(json));
                    queryClient.invalidateQueries({
                      queryKey: ["operation", entityId],
                    });
                  }}
                  placeholder={t("Enter")}
                />
              </FormControl>
            </FormItem>
          )}
        />
        {draftAvailable && (
          <div className="flex gap-5 justify-center">
            <Button
              variant="outline"
              type="button"
              onClick={async () => discardDrafts()}
              className="w-full"
            >
              {t("Discard")}
            </Button>
            <Button variant="outline" type="submit" className="w-full">
              {t("Submit")}
            </Button>
          </div>
        )}
        <div className="flex justify-center items-center">
          <div className="max-w-80 text-left italic text-sm">
            {t("EntityMetaData", {
              name: meta?.UpdatedBy,
              date: formatTimestamp(meta.UpdatedAt ?? "")[0],
              time: formatTimestamp(meta.UpdatedAt ?? "")[1],
            })}
          </div>
        </div>
      </form>{" "}
    </Form>
  ) : showSkeletons ? (
    <div className="flex flex-col gap-5 py-5">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="w-full h-10" />
      ))}
    </div>
  ) : null;
}
