import { TextField, TextFieldProps } from "@mui/material";
import { Control, Controller, FieldValues, Path, RegisterOptions } from "react-hook-form";

type FormInputProps<T extends FieldValues> = TextFieldProps & {
  className?: string;
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
};

export default function FormInput<T extends FieldValues>({
  name,
  control,
  rules,
  ...muiProps
}: FormInputProps<T>) {
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
            size={muiProps.size || "small"}
            fullWidth
            /* sx={{
             "& .MuiOutlinedInput-root": {
             backgroundColor: "#f9fafb",
             borderRadius: 1,
             },
            }} */
          />
        </div>
      )}
    />
  );
}
