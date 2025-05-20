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
import {
  CalendarCog,
  CalendarPlus,
  Info,
  StickyNote,
  UserRoundPen,
  UserRoundPlus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useState } from "react";
import { Dock, DockIcon } from "../ui/dock";
import { ScrollArea } from "@/components/ui/scroll-area";

const formSchema = z.object({
  Name: z.string().optional(),
  Comment: z.string().optional(),
  StatusColor: z.string().optional(),
  AssemblyArea: z.string().optional(),
});

export function LineForm() {
  const { t } = useTranslation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      console.log(values);
      toast("Form submitted successfully");
    } catch (error) {
      console.error("Form submission error", error);
      toast.error("Failed to submit the form. Please try again.");
    }
  }

  const [commentOpen, setCommentOpen] = useState(false);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
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
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCommentOpen(commentOpen ? false : true)}
            type="button"
          >
            <StickyNote />
          </Button>
          <FormField
            control={form.control}
            name="StatusColor"
            render={({ field }) => (
              <FormItem className="my-auto ml-auto">
                <FormControl>
                  <RadioGroup
                    className="flex gap-1.5"
                    defaultValue="empty"
                    onValueChange={field.onChange}
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
                    placeholder="Comment"
                    {...field}
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
              <FormLabel>{t("Name")}</FormLabel>
              <FormControl>
                <Input placeholder="Name" type="" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="AssemblyArea"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("AssemblyArea")}</FormLabel>
              <FormControl>
                <Input placeholder="AssemblyArea" type="" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <Button
          variant="outline"
          type="submit"
          className="col-span-2 w-1/2 mx-auto"
        >
          {t("Submit")}
        </Button>
        <div className="col-span-2 flex justify-center items-center">
          <div className="max-w-80 text-center italic text-sm">
            Wurde zuletzt von Sandro Leuchter am 10.05.2025 um 17:00 Uhr
            bearbeitet
          </div>
        </div>
      </form>
    </Form>
  );
}
