import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function LineForm() {
  const { t } = useTranslation();

  const formSchema = z.object({
    Host: z.string().min(1, {
      message: "Required!",
    }),
    Port: z.number().min(1, {
      message: "Required!",
    }),
    Database: z.string().min(1, {
      message: "Required!",
    }),
    User: z.string().min(1, {
      message: "Required!",
    }),
    Password: z.string().min(1, {
      message: "Required!",
    }),
    Encrypted: z.boolean(),
    TrustServerCertificate: z.boolean(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      Host: "localhost",
      Port: 1433,
      Database: "db",
      User: "sa",
      Password: "",
      Encrypted: true,
      TrustServerCertificate: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    toast(`${t("DSNDialog Toast")}`);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-2 gap-7"
      >
        <FormField
          control={form.control}
          name="Host"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Host</FormLabel>
              <FormControl>
                <Input placeholder="localhost" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="Port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Port</FormLabel>
              <FormControl>
                <Input type="number" placeholder="1433" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="Database"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Database</FormLabel>
              <FormControl>
                <Input placeholder="db" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="User"
          render={({ field }) => (
            <FormItem>
              <FormLabel>User</FormLabel>
              <FormControl>
                <Input placeholder="sa" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="Password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input placeholder="" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex flex-col justify-around ml-2">
          <FormField
            control={form.control}
            name="Encrypted"
            render={({ field }) => (
              <FormItem className="flex flex-col space-y-1 justify-center">
                <div className="flex items-center space-x-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      id="Encrypted"
                      className="accent-black w-4 h-4"
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="Encrypted"
                    className="mb-0 cursor-pointer"
                  >
                    Encrypted
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="TrustServerCertificate"
            render={({ field }) => (
              <FormItem className="flex flex-col space-y-1 justify-center">
                <div className="flex items-center space-x-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      id="TrustServerCertificate"
                      className="accent-black w-4 h-4"
                    />
                  </FormControl>
                  <FormLabel
                    htmlFor="TrustServerCertificate"
                    className="mb-0 cursor-pointer"
                  >
                    TrustServer
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          className="col-span-2 w-1/3 mx-auto"
        >
          Submit
        </Button>
      </form>
    </Form>
  );
}
