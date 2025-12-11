import { TextFieldProps } from "@mui/material";
import { MuiOtpInput } from "mui-one-time-password-input";
import { Control, Controller, FieldValues, Path, RegisterOptions } from "react-hook-form";

type FormNumberProps<T extends FieldValues> = TextFieldProps & {
  className?: string;
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
  length?: number;
};

export default function FormOtp<T extends FieldValues>({
  name,
  control,
  rules,
  length = 6,
  ...muiProps
}: FormNumberProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <div className="w-full">
          <MuiOtpInput
            {...field}
            length={length}
            className="w-full"
            TextFieldsProps={{
              size: muiProps.size || "small",
              error: !!muiProps.error,
            }}
          />
          <p className="mt-1 text-sm text-red-700">{muiProps.helperText}</p>
        </div>
      )}
    />
  );
}
