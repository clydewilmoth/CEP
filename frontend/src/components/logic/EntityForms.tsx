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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, SquarePen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GetAllEntities,
  GetEntityDetails,
  GetGlobalLastUpdateTimestamp,
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

export function LineForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState } = useContext();

  useEffect(() => {
    (async () => {
      const line = await GetEntityDetails("line", entityId);
      setMeta({ UpdatedAt: line.UpdatedAt, UpdatedBy: line.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      form.reset({
        Name: json.Name ?? line.Name ?? "",
        Comment: json.Comment ?? line.Comment ?? "",
        StatusColor: json.StatusColor ?? line.StatusColor ?? "empty",
        AssemblyArea: json.AssemblyArea ?? line.AssemblyArea ?? "",
      });
      setFormReady(true);
      queryClient.invalidateQueries({
        queryKey: ["line", entityId],
      });
    })();
  }, [observer, dbState]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    AssemblyArea: z.string().max(3).optional(),
  });

  function clearDrafts() {
    localStorage.removeItem(entityId);
    setObserver((prev) => prev + 1);
  }

  function checkDraftsAvailable() {
    return localStorage.getItem(entityId) != null ? true : false;
  }

  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const { data: line } = useQuery({
    queryKey: ["line", entityId],
    queryFn: async () => {
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
    if (!checkDraftsAvailable()) return toast.error(t("NoDraft"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
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
      lastKnownUpdate,
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("line") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    formReady && (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(() => submitForm())}
          className="py-5 pt-7 flex flex-col gap-8"
        >
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
              {line && line.StatusColor?.draft && <SquarePen size={15} />}
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
              <div className="flex gap-3 ">
                <FormLabel>{t("Comment")}</FormLabel>
                {line && line.Comment?.draft && <SquarePen size={15} />}
              </div>

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
                <div className="flex gap-3">
                  <FormLabel>{t("Name")}</FormLabel>
                  {line && line.Name?.draft && <SquarePen size={15} />}
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
                <div className="flex gap-3">
                  <FormLabel>{t("AssemblyArea")}</FormLabel>
                  {line && line.AssemblyArea?.draft && <SquarePen size={15} />}
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
                      json.AssemblyArea = e.target.value;
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
          <div className="flex justify-center items-center">
            <div className="max-w-80 text-center italic text-sm">
              {t("EntityMetaData", {
                name: meta?.UpdatedBy,
                date: meta?.UpdatedAt?.split("T")[0]
                  .split("-")
                  .reverse()
                  .join("."),
                time: meta?.UpdatedAt?.split("T")[1]
                  .split(".")[0]
                  .split(":")
                  .slice(0, 2)
                  .join(":"),
              })}
            </div>
          </div>
        </form>
      </Form>
    )
  );
}

export function StationForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState } = useContext();

  useEffect(() => {
    (async () => {
      const station = await GetEntityDetails("station", entityId);
      setMeta({ UpdatedAt: station.UpdatedAt, UpdatedBy: station.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      form.reset({
        Name: json.Name ?? station.Name ?? "",
        Comment: json.Comment ?? station.Comment ?? "",
        StatusColor: json.StatusColor ?? station.StatusColor ?? "empty",
        Description: json.Description ?? station.Description ?? "",
        StationType: json.StationType ?? station.StationType ?? "",
      });
      setFormReady(true);
      queryClient.invalidateQueries({
        queryKey: ["station", entityId],
      });
    })();
  }, [observer, dbState]);

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

  function checkDraftsAvailable() {
    return localStorage.getItem(entityId) != null ? true : false;
  }

  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const { data: station } = useQuery({
    queryKey: ["station", entityId],
    queryFn: async () => {
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
    if (!checkDraftsAvailable()) return toast.error(t("NoDraft"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
    let changesRecord: Record<string, string> = {};

    const stationDb = await GetEntityDetails("station", entityId);
    if (!station) return;
    Object.entries(station).forEach(([key, value]) => {
      if (value.draft && stationDb.key != value.data) {
        changesRecord[key] = value.data;
      }
    });

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "station",
      entityId,
      lastKnownUpdate,
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("station") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    formReady && (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(() => submitForm())}
          className="py-5 pt-7 flex flex-col gap-8"
        >
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
              {station && station.StatusColor?.draft && <SquarePen size={15} />}
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
              <div className="flex gap-3 ">
                <FormLabel>{t("Comment")}</FormLabel>
                {station && station.Comment?.draft && <SquarePen size={15} />}
              </div>

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
                <div className="flex gap-3">
                  <FormLabel>{t("Name")}</FormLabel>
                  {station && station.Name?.draft && <SquarePen size={15} />}
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
                <div className="flex gap-3">
                  <FormLabel>{t("Station Description")}</FormLabel>
                  {station && station.Description?.draft && (
                    <SquarePen size={15} />
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
                <div className="flex gap-3">
                  <FormLabel>{t("Station Type")}</FormLabel>
                  {station && station.StationType?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
          <div className="flex justify-center items-center">
            <div className="max-w-80 text-center italic text-sm">
              {t("EntityMetaData", {
                name: meta?.UpdatedBy,
                date: meta?.UpdatedAt?.split("T")[0]
                  .split("-")
                  .reverse()
                  .join("."),
                time: meta?.UpdatedAt?.split("T")[1]
                  .split(".")[0]
                  .split(":")
                  .slice(0, 2)
                  .join(":"),
              })}
            </div>
          </div>
        </form>
      </Form>
    )
  );
}

export function ToolForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const { dbState } = useContext();

  useEffect(() => {
    (async () => {
      const tool = await GetEntityDetails("tool", entityId);
      setMeta({ UpdatedAt: tool.UpdatedAt, UpdatedBy: tool.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
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
      queryClient.invalidateQueries({
        queryKey: ["tool", entityId],
      });
    })();
  }, [observer, dbState]);

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
          )
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

  function checkDraftsAvailable() {
    return localStorage.getItem(entityId) != null ? true : false;
  }

  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const { data: tool } = useQuery({
    queryKey: ["tool", entityId],
    queryFn: async () => {
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
    if (!checkDraftsAvailable()) return toast.error(t("NoDraft"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
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
      if (operations) {
        operations.forEach(async ({ ID }) => {
          UpdateEntityFieldsString(
            String(localStorage.getItem("name")),
            "operation",
            ID,
            lastKnownUpdate,
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
    }

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "tool",
      entityId,
      lastKnownUpdate,
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("tool") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);
  const [spsChecked, setSpsChecked] = useState(false);

  return (
    formReady && (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(() => submitForm())}
          className="py-5 pt-7 flex flex-col gap-8"
        >
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
              {tool && tool.StatusColor?.draft && <SquarePen size={15} />}
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
              <div className="flex gap-3 ">
                <FormLabel>{t("Comment")}</FormLabel>
                {tool && tool.Comment?.draft && <SquarePen size={15} />}
              </div>

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
                <div className="flex gap-3">
                  <FormLabel>{t("Name")}</FormLabel>
                  {tool && tool.Name?.draft && <SquarePen size={15} />}
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
                  <FormLabel>{t("Operation Description")}</FormLabel>
                  {tool && tool.Description?.draft && <SquarePen size={15} />}
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
                <div className="flex gap-3">
                  <FormLabel>{t("Tool Class")}</FormLabel>
                  {tool && tool.ToolClass?.draft && <SquarePen size={15} />}
                </div>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.ToolClass = value;
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
                <div className="flex gap-3">
                  <FormLabel>{t("Tool Type")}</FormLabel>
                  {tool && tool.ToolType?.draft && <SquarePen size={15} />}
                </div>
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
                    {data.ToolTypes.map((tooltype) => {
                      let skip = true;

                      if (
                        !form.getValues().ToolClass ||
                        form.getValues().ToolClass == "none"
                      )
                        skip = false;
                      else if (
                        form.getValues().ToolClass == tooltype.toolClassId
                      )
                        skip = false;

                      return (
                        !skip && (
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
                              <TooltipContent>
                                <div className="max-w-md">
                                  {t(
                                    "TT_" +
                                      String(tooltype.id) +
                                      "_" +
                                      String(tooltype.toolClassId) +
                                      "_HelpText"
                                  )}
                                </div>
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
            name="IpAddressDevice"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-3">
                  <FormLabel>{t("IpAddressDevice")}</FormLabel>
                  {tool && tool.IpAddressDevice?.draft && (
                    <SquarePen size={15} />
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
                      json.IpAddressDevice = e.target.value;
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

          <div className="flex flex-row items-center gap-2 rounded-md pl-4 border h-10">
            <input
              type="checkbox"
              checked={!!spsChecked}
              readOnly
              className="hover:cursor-pointer"
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
                    <div className="flex gap-3">
                      <FormLabel>{t("SPSPLCNameSPAService")}</FormLabel>
                      {tool && tool.SPSPLCNameSPAService?.draft && (
                        <SquarePen size={15} />
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
                    <div className="flex gap-3">
                      <FormLabel>{t("SPSDBNoSend")}</FormLabel>
                      {tool && tool.SPSDBNoSend?.draft && (
                        <SquarePen size={15} />
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
                    <div className="flex gap-3">
                      <FormLabel>{t("SPSDBNoReceive")}</FormLabel>
                      {tool && tool.SPSDBNoReceive?.draft && (
                        <SquarePen size={15} />
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
                    <div className="flex gap-3">
                      <FormLabel>{t("SPSPreCheck")}</FormLabel>
                      {tool && tool.SPSPreCheck?.draft && (
                        <SquarePen size={15} />
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
                    <div className="flex gap-3">
                      <FormLabel>{t("SPSAddressInSendDB")}</FormLabel>
                      {tool && tool.SPSAddressInSendDB?.draft && (
                        <SquarePen size={15} />
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
                    <div className="flex gap-3">
                      <FormLabel>{t("SPSAddressInReceiveDB")}</FormLabel>
                      {tool && tool.SPSAddressInReceiveDB?.draft && (
                        <SquarePen size={15} />
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
          <div className="flex justify-center items-center">
            <div className="max-w-80 text-center italic text-sm">
              {t("EntityMetaData", {
                name: meta?.UpdatedBy,
                date: meta?.UpdatedAt?.split("T")[0]
                  .split("-")
                  .reverse()
                  .join("."),
                time: meta?.UpdatedAt?.split("T")[1]
                  .split(".")[0]
                  .split(":")
                  .slice(0, 2)
                  .join(":"),
              })}
            </div>
          </div>
        </form>
      </Form>
    )
  );
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
  const { dbState } = useContext();

  const [parentTool, setParentTool] = useState<any>();

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

      const jsonDecisionCriteria =
        json.DecisionCriteria && json.DecisionCriteria.split("|");
      const operationDecisionCriteria =
        operation.DecisionCriteria && operation.DecisionCriteria.split("|");

      form.reset({
        Name: json.Name ?? operation.Name ?? "",
        Comment: json.Comment ?? operation.Comment ?? "",
        StatusColor: json.StatusColor ?? operation.StatusColor ?? "empty",
        Description: json.Description ?? operation.Description ?? "",
        StationType: station.StationType ?? "",
        SerialOrParallel:
          json.SerialOrParallel ?? operation.SerialOrParallel ?? "",
        SequenceGroup: json.SequenceGroup ?? operation.SequenceGroup ?? "",
        Sequence: json.Sequence ?? operation.Sequence ?? "",
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
      queryClient.invalidateQueries({
        queryKey: ["operation", entityId],
      });
    })();
  }, [observer, dbState]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
    StationType: z.string().optional(),
    SerialOrParallel: z.string().optional(),
    SequenceGroup: z.string().optional(),
    Sequence: z.string().optional(),
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

  function checkDraftsAvailable() {
    return localStorage.getItem(entityId) != null ? true : false;
  }

  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const { data: operation } = useQuery({
    queryKey: ["operation", entityId],
    queryFn: async () => {
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
    if (!checkDraftsAvailable()) return toast.error(t("NoDraft"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
    let changesRecord: Record<string, string> = {};

    const operationDb = await GetEntityDetails("operation", entityId);
    if (!operation) return;
    Object.entries(operation).forEach(([key, value]) => {
      if (value.draft && operationDb.key != value.data) {
        if (key == "DecisionCriteria") {
          changesRecord[key] = value.data.join("|");
          return;
        }
        changesRecord[key] = value.data;
      }
    });

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "operation",
      entityId,
      lastKnownUpdate,
      changesRecord
    );

    discardDrafts();

    toast.success(t("SubmitSuccess", { entityType: t("operation") }));
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    formReady && (
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(() => submitForm())}
          className="py-5 pt-7 flex flex-col gap-8"
        >
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
                <SquarePen size={15} />
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
              <div className="flex gap-3 ">
                <FormLabel>{t("Comment")}</FormLabel>
                {operation && operation.Comment?.draft && (
                  <SquarePen size={15} />
                )}
              </div>

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
                <div className="flex gap-3">
                  <FormLabel>{t("Name")}</FormLabel>
                  {operation && operation.Name?.draft && (
                    <SquarePen size={15} />
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
                <div className="flex gap-3">
                  <FormLabel>{t("Operation Description")}</FormLabel>
                  {operation && operation.Description?.draft && (
                    <SquarePen size={15} />
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
                <div className="flex gap-3">
                  <FormLabel>{t("Serial / Parallel")}</FormLabel>
                  {operation && operation.SerialOrParallel?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
                      queryKey: ["station", entityId],
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
            name="SequenceGroup"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-3">
                  <FormLabel>{t("SequenceGroup")}</FormLabel>
                  {operation && operation.SequenceGroup?.draft && (
                    <SquarePen size={15} />
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
                      json.SequenceGroup = e.target.value;
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
            name="Sequence"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-3">
                  <FormLabel>{t("Sequence")}</FormLabel>
                  {operation && operation.Sequence?.draft && (
                    <SquarePen size={15} />
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
                      json.Sequence = e.target.value;
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
            name="AlwaysPerform"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-2 rounded-md pl-4 border h-10 space-y-0">
                <FormControl>
                  <Checkbox
                    className="hover:cursor-pointer"
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
                <div className="flex gap-3">
                  <FormLabel className="hover:cursor-pointer">
                    {t("AlwaysPerform")}
                  </FormLabel>
                  {operation && operation.AlwaysPerform?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="QGateRelevant"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-3">
                  <FormLabel>{t("QGateRelevant")}</FormLabel>
                  {operation && operation.QGateRelevant?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
                      <SelectValue
                        placeholder={t("QGateRelevant Placeholder")}
                      />
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
                <div className="flex gap-3">
                  <FormLabel>{t("Template")}</FormLabel>
                  {operation && operation.Template?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
                <Select
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const json = JSON.parse(
                      localStorage.getItem(entityId) ?? "{}"
                    );
                    json.Template = value;
                    if (value == "none") {
                      json.DecisionClass = value;
                      json.VerificationClass = value;
                      json.GenerationClass = value;
                      json.SavingClass = value;
                      localStorage.setItem(entityId, JSON.stringify(json));
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
                <div className="flex gap-3">
                  <FormLabel>{t("OperationClassDecision")}</FormLabel>
                  {operation && operation.DecisionClass?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
                              <TooltipContent>
                                <div className="max-w-md">
                                  {t(
                                    "OC_DECISION_" +
                                      String(decisionclass.id) +
                                      "_HelpText"
                                  )}
                                </div>
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
                <div className="flex gap-3">
                  <FormLabel>{t("OperationClassVerification")}</FormLabel>
                  {operation && operation.VerificationClass?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
                      <SelectValue
                        placeholder={t("Verification Placeholder")}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {data.VerificationClasses.map((verificationclass) => {
                      let skip = true;
                      if (
                        form.getValues().Template ==
                        verificationclass.templateId
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
                                  key={
                                    "OC_VERIFICATION_" + verificationclass.id
                                  }
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
                              <TooltipContent>
                                <div className="max-w-md">
                                  {t(
                                    "OC_VERIFICATION_" +
                                      String(verificationclass.id) +
                                      "_" +
                                      String(verificationclass.templateId) +
                                      "_HelpText"
                                  )}
                                </div>
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
                <div className="flex gap-3">
                  <FormLabel>{t("OperationClassGeneration")}</FormLabel>
                  {operation && operation.GenerationClass?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
                      if (
                        form.getValues().Template == generationclass.templateId
                      )
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
                              <TooltipContent>
                                <div className="max-w-md">
                                  {t(
                                    "OC_GENERATION_" +
                                      String(generationclass.id) +
                                      "_" +
                                      String(generationclass.templateId) +
                                      "_HelpText"
                                  )}
                                </div>
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
                <div className="flex gap-3">
                  <FormLabel>{t("OperationClassSaving")}</FormLabel>
                  {operation && operation.SavingClass?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
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
                              <TooltipContent>
                                <div className="max-w-md">
                                  {t(
                                    "OC_SAVING_" +
                                      String(savingclass.id) +
                                      "_" +
                                      String(savingclass.templateId) +
                                      "_HelpText"
                                  )}
                                </div>
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
                <div className="flex gap-3">
                  <FormLabel>{t("DecisionCriteria")}</FormLabel>
                  {operation && operation.DecisionCriteria?.draft && (
                    <SquarePen size={15} />
                  )}
                </div>
                <FormControl>
                  <TagsInput
                    value={field.value ?? []}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const json = JSON.parse(
                        localStorage.getItem(entityId) ?? "{}"
                      );
                      json.DecisionCriteria = value.join("|");
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

          <div className="flex justify-center items-center">
            <div className="max-w-80 text-center italic text-sm">
              {t("EntityMetaData", {
                name: meta?.UpdatedBy,
                date: meta?.UpdatedAt?.split("T")[0]
                  .split("-")
                  .reverse()
                  .join("."),
                time: meta?.UpdatedAt?.split("T")[1]
                  .split(".")[0]
                  .split(":")
                  .slice(0, 2)
                  .join(":"),
              })}
            </div>
          </div>
        </form>
      </Form>
    )
  );
}

function stringToBoolean(value: string | undefined | null): boolean {
  return value?.toLowerCase() === "true";
}

function booleanToString(value: boolean): string {
  return value ? "true" : "false";
}
