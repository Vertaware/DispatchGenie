import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker, DatePickerProps } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import { Control, Controller, FieldValues, Path, RegisterOptions } from "react-hook-form";

type FormDateProps<T extends FieldValues> = DatePickerProps & {
  className?: string;
  control: Control<T>;
  name: Path<T>;
  rules?: RegisterOptions<T, Path<T>>;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  required?: boolean;
};

export default function FormDate<T extends FieldValues>({
  name,
  control,
  rules,
  size,
  error,
  helperText,
  required,
  ...muiProps
}: FormDateProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field }) => {
        const { value, onChange, ref } = field;
        const parsedValue = typeof value === "string" && value.length > 0 ? dayjs(value) : null;

        return (
          <div className="w-full min-w-0">
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                {...muiProps}
                value={parsedValue}
                onChange={(selectedDate) => {
                  onChange(selectedDate ? selectedDate.toISOString() : "");
                }}
                className="w-full"
                sx={{ width: "100%" }}
                format="DD/MM/YYYY"
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: size || "small",
                    error: error,
                    helperText: helperText,
                    required: required,
                    inputRef: ref,
                    sx: {
                      width: "100%",
                      maxWidth: "none",
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: "#f9fafb",
                        borderRadius: 1,
                      },
                    },
                    InputLabelProps: { shrink: true },
                  },
                }}
              />
            </LocalizationProvider>
          </div>
        );
      }}
    />
  );
}
