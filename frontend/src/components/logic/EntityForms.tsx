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
      });
      setFormReady(true);
    })();
  }, [observer]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    Description: z.string().optional(),
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
                {station && station.Description?.draft && <SquarePen size={15} />}
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
      });
      setFormReady(true);
    })();
  }, [observer]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
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
      await clearDrafts();
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
      if (tool.draft) {
        changesRecord[key] = value.data;
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
                          queryKey: ["operaation", entityId],
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
const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    (async () => {
      const operation = await GetEntityDetails("operation", entityId);
      setMeta({ UpdatedAt: operation.UpdatedAt, UpdatedBy: operation.UpdatedBy });
      const json = JSON.parse(localStorage.getItem(entityId) ?? "{}");
      form.reset({
        Name: json.Name ?? operation.Name ?? "",
        Comment: json.Comment ?? operation.Comment ?? "",
        StatusColor: json.StatusColor ?? operation.StatusColor ?? "empty",
      });
      setFormReady(true);
    })();
  }, [observer]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
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
            {operation && operation.StatusColor?.draft && <SquarePen size={15} />}
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