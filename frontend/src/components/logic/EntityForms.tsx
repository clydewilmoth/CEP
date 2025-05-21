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
import { Info, SquarePen, StickyNote } from "lucide-react";
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

export function LineForm({
  entityId,
  entityType,
}: {
  entityId: string;
  entityType: string;
}) {
  const [meta, setMeta] = useState<{ UpdatedAt?: string; UpdatedBy?: string }>(
    {}
  );
  const [observer, setObserver] = useState(0);

  useEffect(() => {
    (async () => {
      const line = await GetEntityDetails(entityType, entityId);
      setMeta({ UpdatedAt: line.UpdatedAt, UpdatedBy: line.UpdatedBy });
      form.reset({
        Name: localStorage.getItem(entityId + "Name") || line.Name || "",
        Comment:
          localStorage.getItem(entityId + "Comment") || line.Comment || "",
        StatusColor:
          localStorage.getItem(entityId + "StatusColor") ||
          line.StatusColor ||
          "empty",
        AssemblyArea:
          localStorage.getItem(entityId + "AssemblyArea") ||
          line.AssemblyArea ||
          "",
      });
    })();
  }, [observer]);

  const formSchema = z.object({
    Name: z.string().optional(),
    Comment: z.string().optional(),
    StatusColor: z.string().optional(),
    AssemblyArea: z.string().max(3).optional(),
  });

  async function clearDrafts() {
    localStorage.removeItem(entityId + "Name");
    localStorage.removeItem(entityId + "Comment");
    localStorage.removeItem(entityId + "StatusColor");
    localStorage.removeItem(entityId + "AssemblyArea");
    setObserver((prev) => prev + 1);
  }

  const { t } = useTranslation();

  const queryClient = useQueryClient();

  const { data: line } = useQuery({
    queryKey: ["line", entityId],
    queryFn: async () => {
      const values = form.getValues();
      const res: Record<string, any> = {};
      Object.entries(values).forEach(([key, value]) => {
        return localStorage.getItem(entityId + key) != null
          ? (res[key] = { data: value, draft: true })
          : { data: value, draft: false };
      });
      return res;
    },
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
      entityType,
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
        className="py-5 grid grid-cols-2 gap-8"
      >
        <div className="col-span-2 flex gap-3">
          <div className="flex gap-3 items-center">
            <h1 className="text-2xl font-bold">{t("line")}</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info size="18" />
                </TooltipTrigger>
                <TooltipContent>{t("Line Description")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-3 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCommentOpen(commentOpen ? false : true)}
              type="button"
            >
              <StickyNote />
            </Button>
            {line?.Comment?.draft && <SquarePen size={15} />}
          </div>
          <FormField
            control={form.control}
            name="StatusColor"
            render={({ field }) => (
              <FormItem className="my-auto ml-auto">
                <FormControl>
                  <RadioGroup
                    className="flex gap-1.5"
                    value={field.value ?? "empty"}
                    onValueChange={(value: string) => (
                      field.onChange(value),
                      localStorage.setItem(entityId + "StatusColor", value),
                      queryClient.invalidateQueries({
                        queryKey: ["line", entityId],
                      })
                    )}
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
        {commentOpen && (
          <FormField
            control={form.control}
            name="Comment"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormControl>
                  <Textarea
                    {...field}
                    onChange={(e) => (
                      field.onChange(e.target.value),
                      localStorage.setItem(
                        entityId + "Comment",
                        e.target.value
                      ),
                      queryClient.invalidateQueries({
                        queryKey: ["line", entityId],
                      })
                    )}
                    className="h-32 resize-none"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="Name"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-3">
                <FormLabel>{t("Name")}</FormLabel>
                {line?.Name?.draft && <SquarePen size={15} />}
              </div>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => (
                    field.onChange(e.target.value),
                    localStorage.setItem(entityId + "Name", e.target.value),
                    queryClient.invalidateQueries({
                      queryKey: ["line", entityId],
                    })
                  )}
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
                {line?.AssemblyArea?.draft && <SquarePen size={15} />}
              </div>
              <FormControl>
                <Input
                  {...field}
                  onChange={(e) => (
                    field.onChange(e.target.value),
                    localStorage.setItem(
                      entityId + "AssemblyArea",
                      e.target.value
                    ),
                    queryClient.invalidateQueries({
                      queryKey: ["line", entityId],
                    })
                  )}
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
