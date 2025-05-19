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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

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

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="py-5 grid grid-cols-2 gap-8"
      >
        <h1 className="col-span-2 text-2xl font-bold">{t("line")}</h1>
        <p className="col-span-2">{t("Line Description")}</p>
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
          name="Comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("Comment")}</FormLabel>
              <FormControl>
                <Input placeholder="Comment" type="" {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="StatusColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("StatusColor")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="StatusColor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Red">{t("Red")}</SelectItem>
                  <SelectItem value="Yellow">{t("Yellow")}</SelectItem>
                  <SelectItem value="Green">{t("Green")}</SelectItem>
                </SelectContent>
              </Select>
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
          type="submit"
          variant="outline"
          className="col-span-2 w-1/2 mx-auto"
        >
          {t("Submit")}
        </Button>
      </form>
    </Form>
  );
}
