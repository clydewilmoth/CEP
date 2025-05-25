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

// @ts-ignore
import fertigeJSON from "../../assets/fertigeJSON.json";

import data from "@/assets/fertigeJSON.json";

export function LineForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);

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
  }, [observer]);

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
    if (!checkDraftsAvailable()) return toast(t("LineForm NoDrafts"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
    let changesRecord: Record<string, string> = {};

    if (!line) return;
    Object.entries(line).forEach(([key, value]) => {
      if (value.draft) {
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

    toast(t("LineForm Success"));
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-5 pt-7 grid grid-cols-2 gap-8"
      >
        <div className="col-span-2 flex gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-xl font-bold">{t("line")}</h1>
              </TooltipTrigger>
              <TooltipContent>{t("Line Description")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex gap-3 items-center my-auto ml-auto">
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
                        className="size-6 border-foreground bg-foreground shadow-none data-[state=checked]:border-foreground data-[state=checked]:bg-foreborder-foreground"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border-red-500 bg-red-500 shadow-none data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border-amber-500 bg-amber-500 shadow-none data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border-emerald-500 bg-emerald-500 shadow-none data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-3 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCommentOpen(commentOpen ? false : true)}
              type="button"
            >
              {commentOpen ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>
        {commentOpen && (
          <div className="col-span-2 flex flex-col gap-3">
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
        <Button
          variant="outline"
          type="button"
          onClick={async () => discardDrafts()}
        >
          {t("Discard")}
        </Button>
        <Button variant="outline" type="submit">
          {t("Submit")}
        </Button>
        <div className="col-span-2 flex justify-center items-center">
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
  );
}

export function StationForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);

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
        SerialOrParallel:
          json.SerialOrParallel ?? station.SerialOrParallel ?? "",
      });
      setFormReady(true);
      queryClient.invalidateQueries({
        queryKey: ["station", entityId],
      });
    })();
  }, [observer]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
    StationType: z.string().optional(),
    SerialOrParallel: z.string().optional(),
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
    if (!checkDraftsAvailable()) return toast(t("StationForm NoDrafts"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
    let changesRecord: Record<string, string> = {};

    if (!station) return;
    Object.entries(station).forEach(([key, value]) => {
      if (value.draft) {
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

    toast(t("StationForm Success"));
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-5 pt-7 grid grid-cols-2 gap-8"
      >
        <div className="col-span-2 flex gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-xl font-bold">{t("station")}</h1>
              </TooltipTrigger>
              <TooltipContent>{t("Station Description")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex gap-3 items-center my-auto ml-auto">
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
                        className="size-6 border-foreground bg-foreground shadow-none data-[state=checked]:border-foreground data-[state=checked]:bg-foreborder-foreground"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border-red-500 bg-red-500 shadow-none data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border-amber-500 bg-amber-500 shadow-none data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border-emerald-500 bg-emerald-500 shadow-none data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-3 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCommentOpen(commentOpen ? false : true)}
              type="button"
            >
              {commentOpen ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>
        {commentOpen && (
          <div className="col-span-2 flex flex-col gap-3">
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
                    let skip = true;
                    stationtype.serialOrParallel.every((sop) => {
                      if (
                        !form.getValues().SerialOrParallel ||
                        form.getValues().SerialOrParallel == "none"
                      ) {
                        skip = false;
                        return false;
                      } else if (form.getValues().SerialOrParallel == sop) {
                        skip = false;
                        return false;
                      }
                      return true;
                    });
                    if (
                      !form.getValues().SerialOrParallel ||
                      (form.getValues().SerialOrParallel == "none" &&
                        stationtype.id == "0")
                    )
                      skip = false;
                    return (
                      !skip && (
                        <SelectItem key={stationtype.id} value={stationtype.id}>
                          {t("ST_" + String(stationtype.id) + "_Name")}
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
          name="SerialOrParallel"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-3">
                <FormLabel>{t("Serial / Parallel")}</FormLabel>
                {station && station.SerialOrParallel?.draft && (
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
                      if (
                        !form.getValues().StationType ||
                        form.getValues().StationType == "none"
                      ) {
                        skip = false;
                        return false;
                      } else if (form.getValues().StationType == st) {
                        skip = false;
                        return false;
                      }
                      return true;
                    });

                    return (
                      !skip && (
                        <SelectItem
                          key={serialorparallel.id}
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

        <Button
          variant="outline"
          type="button"
          onClick={async () => discardDrafts()}
        >
          {t("Discard")}
        </Button>
        <Button variant="outline" type="submit">
          {t("Submit")}
        </Button>
        <div className="col-span-2 flex justify-center items-center">
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
  );
}

export function ToolForm({ entityId }: { entityId: string }) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);

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
  }, [observer]);

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
    if (!checkDraftsAvailable()) return toast(t("ToolForm NoDrafts"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
    let changesRecord: Record<string, string> = {};

    if (!tool) return;
    Object.entries(tool).forEach(([key, value]) => {
      if (value.draft) {
        changesRecord[key] = String(value.data);
      }
    });

    await UpdateEntityFieldsString(
      String(localStorage.getItem("name")),
      "tool",
      entityId,
      lastKnownUpdate,
      changesRecord
    );

    discardDrafts();

    toast(t("ToolForm Success"));
  }

  const [commentOpen, setCommentOpen] = useState(false);
  const [spsChecked, setSpsChecked] = useState(false);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-5 pt-7 grid grid-cols-2 gap-8"
      >
        <div className="col-span-2 flex gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-xl font-bold">{t("tool")}</h1>
              </TooltipTrigger>
              <TooltipContent>{t("Tool Description")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex gap-3 items-center my-auto ml-auto">
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
                        className="size-6 border-foreground bg-foreground shadow-none data-[state=checked]:border-foreground data-[state=checked]:bg-foreborder-foreground"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border-red-500 bg-red-500 shadow-none data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border-amber-500 bg-amber-500 shadow-none data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border-emerald-500 bg-emerald-500 shadow-none data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-3 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCommentOpen(commentOpen ? false : true)}
              type="button"
            >
              {commentOpen ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>
        {commentOpen && (
          <div className="col-span-2 flex flex-col gap-3">
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
                        <SelectItem key={toolclass.id} value={toolclass.id}>
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
                    else if (form.getValues().ToolClass == tooltype.toolClassId)
                      skip = false;

                    return (
                      !skip && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <SelectItem key={tooltype.id} value={tooltype.id}>
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
                {tool && tool.IpAddressDevice?.draft && <SquarePen size={15} />}
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

        <div
          className="flex flex-row items-center gap-2 rounded-md pl-4 border hover:cursor-pointer"
          onClick={async () => (
            spsChecked && resetSps(), setSpsChecked((checked) => !checked)
          )}
        >
          <input
            type="checkbox"
            checked={!!spsChecked}
            readOnly
            className="hover:cursor-pointer"
          />
          <FormLabel className="hover:cursor-pointer">
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
                    {tool && tool.SPSDBNoSend?.draft && <SquarePen size={15} />}
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
                    {tool && tool.SPSPreCheck?.draft && <SquarePen size={15} />}
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
        <Button
          variant="outline"
          type="button"
          onClick={async () => discardDrafts()}
        >
          {t("Discard")}
        </Button>
        <Button variant="outline" type="submit">
          {t("Submit")}
        </Button>
        <div className="col-span-2 flex justify-center items-center">
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
  );
}

export function OperationForm({ entityId }: { entityId: string }) {
  const operationClasses = data.OperationClasses;
  const decisionClasses = operationClasses.filter(
    (operationClass) => operationClass.classType === "DECISION"
  );
  const generationnClasses = operationClasses.filter(
    (operationClass) => operationClass.classType === "GENERATION"
  );
  const verificationClasses = operationClasses.filter(
    (operationClass) => operationClass.classType === "VERIFICATION"
  );
  const savingClasses = operationClasses.filter(
    (operationClass) => operationClass.classType === "SAVING"
  );

  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);
  const [decisionClass, setDecisionClassId] = useState<any>([]);
  const [generationClass, setGenerationClassId] = useState<any>([]);
  const [verificationClass, setVerificationClassId] = useState<any>([]);
  const [savingClass, setSavingClassId] = useState<any>([]);
  const [templateId, setTemplateId] = useState<any>([]);

  function getDecisionClass(TemplateId: string) {
    const filteredDecisionClasses = decisionClasses.filter(
      (decisionClass: { templateId: string }) =>
        decisionClass.templateId === TemplateId ||
        decisionClass.templateId === "0"
    );
    setDecisionClassId(filteredDecisionClasses);
  }
  function getGenerationClass(TemplateId: string) {
    const filteredGenerationClasses = generationnClasses.filter(
      (generationClass: { templateId: string }) =>
        generationClass.templateId === TemplateId
    );
    setGenerationClassId(filteredGenerationClasses);
  }
  function getVerificationClass(TemplateId: string) {
    const filteredVerificationClasses = verificationClasses.filter(
      (verificationClass: { templateId: string }) =>
        verificationClass.templateId === TemplateId
    );
    setVerificationClassId(filteredVerificationClasses);
  }
  function getSavingClass(TemplateId: string) {
    const filteredSavingClasses = savingClasses.filter(
      (savingClass: { templateId: string }) =>
        savingClass.templateId === TemplateId
    );
    setSavingClassId(filteredSavingClasses);
  }

  useEffect(() => {
    (async () => {
      const operation = await GetEntityDetails("operation", entityId);
      setMeta({
        UpdatedAt: operation.UpdatedAt,
        UpdatedBy: operation.UpdatedBy,
      });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");

      const initialTemplateId = json.TemplateId ?? operation.TemplateId ?? "";
      form.reset({
        Name: json.Name ?? operation.Name ?? "",
        Comment: json.Comment ?? operation.Comment ?? "",
        StatusColor: json.StatusColor ?? operation.StatusColor ?? "empty",
        Description: json.Description ?? operation.Description ?? "",
        DecisionCriteria:
          json.DecisionCriteria ?? operation.DecisionCriteria ?? "",
        SequenceGroup: json.SequenceGroup ?? operation.SequenceGroup ?? "",
        Sequence: json.Sequence ?? operation.Sequence ?? "",
        AlwaysPerform: json.AlwaysPerform ?? operation.AlwaysPerform ?? "",
        TemplateId: initialTemplateId,
        DecisionClass: json.DecisionClass ?? operation.DecisionClass ?? "",
        VerificationClass:
          json.VerificationClass ?? operation.VerificationClass ?? "",
        GenerationClass:
          json.GenerationClass ?? operation.GenerationClass ?? "",
        SavingClass: json.SavingClass ?? operation.SavingClass ?? "",
      });

      setTemplateId(initialTemplateId);

      if (initialTemplateId) {
        getDecisionClass(initialTemplateId);
        getGenerationClass(initialTemplateId);
        getVerificationClass(initialTemplateId);
        getSavingClass(initialTemplateId);
      } else {
        setDecisionClassId([]);
        setGenerationClassId([]);
        setVerificationClassId([]);
        setSavingClassId([]);
      }

      setFormReady(true);
      queryClient.invalidateQueries({
        queryKey: ["operation", entityId],
      });
    })();
  }, [observer, entityId]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
    DecisionCriteria: z.string().optional(),
    SequenceGroup: z.string().optional(),
    Sequence: z.string().optional(),
    AlwaysPerform: z.string().optional(),
    TemplateId: z.string().min(1, "Template ist erforderlich"),
    DecisionClass: z.string().optional(),
    VerificationClass: z.string().optional(),
    GenerationClass: z.string().optional(),
    SavingClass: z.string().optional(),
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
      await clearDrafts();
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
    if (!checkDraftsAvailable()) return toast(t("OperationForm NoDrafts"));

    const lastKnownUpdate = await GetGlobalLastUpdateTimestamp();
    let changesRecord: Record<string, string> = {};

    if (!operation) return;
    Object.entries(operation).forEach(([key, value]) => {
      if (value.draft) {
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

    toast(t("OperationForm Success"));
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(() => submitForm())}
        className="py-5 pt-7 grid grid-cols-2 gap-8"
      >
        <div className="col-span-2 flex gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <h1 className="text-xl font-bold">{t("operation")}</h1>
              </TooltipTrigger>
              <TooltipContent>{t("Operation Description")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex gap-3 items-center my-auto ml-auto">
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
                        className="size-6 border-foreground bg-foreground shadow-none data-[state=checked]:border-foreground data-[state=checked]:bg-foreborder-foreground"
                      />
                      <RadioGroupItem
                        value="red"
                        aria-label="red"
                        className="size-6 border-red-500 bg-red-500 shadow-none data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
                      />
                      <RadioGroupItem
                        value="amber"
                        aria-label="amber"
                        className="size-6 border-amber-500 bg-amber-500 shadow-none data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
                      />
                      <RadioGroupItem
                        value="emerald"
                        aria-label="emerald"
                        className="size-6 border-emerald-500 bg-emerald-500 shadow-none data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500"
                      />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <div className="flex gap-3 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCommentOpen(commentOpen ? false : true)}
              type="button"
            >
              {commentOpen ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>
        {commentOpen && (
          <div className="col-span-2 flex flex-col gap-3">
            <div className="flex gap-3 ">
              <FormLabel>{t("Comment")}</FormLabel>
              {operation && operation.Comment?.draft && <SquarePen size={15} />}
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
                {operation && operation.Name?.draft && <SquarePen size={15} />}
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
          name="TemplateId"
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
                  setTemplateId(value);
                  getDecisionClass(templateId);
                  getGenerationClass(templateId);
                  getVerificationClass(templateId);
                  getSavingClass(templateId);
                  const json = JSON.parse(
                    localStorage.getItem(entityId) ?? "{}"
                  );
                  json.TemplateId = value;
                  localStorage.setItem(entityId, JSON.stringify(json));
                  queryClient.invalidateQueries({
                    queryKey: ["operation", entityId],
                  });
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("TemplatePlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent></SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="DecisionCriteria"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-3">
                <FormLabel>{t("DecisionCriteria")}</FormLabel>
                {operation && operation.DecisionCriteria?.draft && (
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
                    json.DecisionCriteria = e.target.value;
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
            <FormItem>
              <div className="flex gap-3">
                <FormLabel>{t("AlwaysPerform")}</FormLabel>
                {operation && operation.AlwaysPerform?.draft && (
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
                    json.AlwaysPerform = e.target.value;
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
          name="DecisionClass"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-3">
                <FormLabel>{t("OperationClassDecision")}</FormLabel>
                {operation && operation.OperationClassDecision?.draft && (
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
                    <SelectValue placeholder={t("DecisionPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {decisionClass.map(
                    (decisionClass: {
                      classId: string;
                      templateId: string;
                    }) => (
                      <SelectItem
                        key={decisionClass.classId}
                        value={String(decisionClass.classId)}
                      >
                        {t(
                          "OC_DECISION_" +
                            String(decisionClass.classId) +
                            "_" +
                            String(decisionClass.templateId) +
                            "_ClassDescription"
                        )}
                      </SelectItem>
                    )
                  )}
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
                {operation && operation.OperationClassVerification?.draft && (
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
                    <SelectValue placeholder={t("VerificationPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {verificationClass.map(
                    (verificationClass: {
                      classId: string;
                      templateId: string;
                    }) => (
                      <SelectItem
                        key={verificationClass.classId}
                        value={String(verificationClass.classId)}
                      >
                        {t(
                          "OC_VERIFICATION_" +
                            String(verificationClass.classId) +
                            "_" +
                            String(verificationClass.templateId) +
                            "_ClassDescription"
                        )}
                      </SelectItem>
                    )
                  )}
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
                {operation && operation.OperationClassGeneration?.draft && (
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
                    <SelectValue placeholder={t("GenerationPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {generationClass.map(
                    (generationClass: {
                      classId: string;
                      templateId: string;
                    }) => (
                      <SelectItem
                        key={generationClass.classId}
                        value={String(generationClass.classId)}
                      >
                        {t(
                          "OC_GENERATION_" +
                            String(generationClass.classId) +
                            "_" +
                            String(generationClass.templateId) +
                            "_ClassDescription"
                        )}
                      </SelectItem>
                    )
                  )}
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
                {operation && operation.OperationClassSaving?.draft && (
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
                    <SelectValue placeholder={t("SavingPlaceholder")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {savingClass.map(
                    (savingClass: { classId: string; templateId: string }) => (
                      <SelectItem
                        key={savingClass.classId}
                        value={String(savingClass.classId)}
                      >
                        {t(
                          "OC_SAVING_" +
                            String(savingClass.classId) +
                            "_" +
                            String(savingClass.templateId) +
                            "_ClassDescription"
                        )}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <div></div>
        <Button
          variant="outline"
          type="button"
          onClick={async () => discardDrafts()}
        >
          {t("Discard")}
        </Button>
        <Button variant="outline" type="submit">
          {t("Submit")}
        </Button>

        <div className="col-span-2 flex justify-center items-center">
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
  );
}
