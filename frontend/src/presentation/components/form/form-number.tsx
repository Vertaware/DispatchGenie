import { TextField, TextFieldProps } from "@mui/material";
import { Control, Controller, FieldValues, Path, RegisterOptions } from "react-hook-form";

type FormNumberProps<T extends FieldValues> = TextFieldProps & {
  className?: string;
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
};

export default function FormNumber<T extends FieldValues>({
  name,
  control,
  rules,
  ...muiProps
}: FormNumberProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <div className="w-full">
          <TextField
            {...field}
            {...muiProps}
            type="number"
            size={muiProps.size || "small"}
            fullWidth
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
              }
            }}
            onWheel={(e) => (e.target as HTMLInputElement)?.blur()}
          />
        </div>
      )}
    />
  );
}
