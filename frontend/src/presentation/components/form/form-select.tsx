import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectProps } from "@mui/material/Select";
import { Control, Controller, FieldValues, Path, RegisterOptions } from "react-hook-form";

type FormSelectProps<T extends FieldValues> = SelectProps & {
  className?: string;
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
  options: { value: string; label: string; disabled?: boolean }[];
  size: "small" | "normal";
  helperText?: string;
  disabled?: boolean;
};

export default function FormSelect<T extends FieldValues>({
  name,
  control,
  rules,
  size = "small",
  options,
  helperText,
  disabled,
  ...muiProps
}: FormSelectProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => (
        <div className="w-full">
          <FormControl fullWidth>
            <InputLabel id={`${name}-label`} size={size}>
              {muiProps.label}
            </InputLabel>
            <Select
              {...field}
              disabled={disabled}
              labelId={`${name}-label`}
              id={`${name}-select`}
              label={muiProps.label}
              size={size}
              error={!!muiProps.error}
            >
              {options?.map((option) => (
                <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {muiProps.error && <p className="mt-1 text-sm text-red-700">{helperText}</p>}
          </FormControl>
        </div>
      )}
    />
  );
}
