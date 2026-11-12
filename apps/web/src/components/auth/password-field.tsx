import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

export function PasswordField({
  label,
  id,
  ...props
}: Omit<ComponentProps<typeof InputGroupInput>, "type" | "id"> & {
  label: string;
  id: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field className="flex flex-col gap-2 space-y-0">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="h-10">
        <InputGroupInput
          {...props}
          id={id}
          className="h-10 px-3"
          type={visible ? "text" : "password"}
        />
        <InputGroupAddon align="end" className="pl-1.5">
          <button
            aria-label={visible ? "Hide password" : "Show password"}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            type="button"
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
