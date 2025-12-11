"use client";

import { Autocomplete, CircularProgress, TextField } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Article } from "~/domain/entities/article";
import { searchArticles } from "~/infrastructure/services/article.service";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface ArticleAutocompleteProps {
  value: Article | null;
  onChange: (article: Article | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  label?: string;
}

export default function ArticleAutocomplete({
  value,
  onChange,
  error,
  helperText,
  disabled,
  label = "Article Description",
}: ArticleAutocompleteProps) {
  // Initialize inputValue from value prop
  const [inputValue, setInputValue] = useState(() => value?.description || "");
  const debouncedSearch = useDebounce(inputValue, 300);

  // Sync inputValue with value when value changes externally (e.g., form reset)
  useEffect(() => {
    const newInputValue = value?.description || "";
    setInputValue(newInputValue);
  }, [value?.description, value?.id]); // Watch description and id to catch all changes

  const { data, isLoading } = useQuery({
    queryKey: ["articles", debouncedSearch],
    queryFn: () => searchArticles({ search: debouncedSearch, pageSize: 20 }),
    enabled: debouncedSearch.length >= 2 || debouncedSearch.length === 0,
  });

  const options = data?.data ?? [];

  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, newInputValue, reason) => {
        setInputValue(newInputValue);
        // Don't save on every keystroke - only when user clears or when they blur/select
        if (reason === "clear") {
          onChange(null);
        }
      }}
      onChange={(_, newValue) => {
        if (typeof newValue === "object" && newValue && "id" in newValue) {
          // User selected an option from the dropdown
          onChange(newValue as Article);
        } else if (typeof newValue === "string" && newValue.trim() !== "") {
          // User typed freely (freeSolo) - create Article object with the typed text
          const tempArticle: Article = {
            id: value?.id || "", // Preserve existing ID if any
            tenantId: value?.tenantId || "",
            description: newValue.trim(),
            quantity: value?.quantity || 0, // Preserve existing quantity if any
            createdAt: value?.createdAt || "",
            updatedAt: value?.updatedAt || "",
          };
          onChange(tempArticle);
        } else {
          // Empty or null value
          onChange(null);
        }
      }}
      onBlur={() => {
        // When user blurs, save the current inputValue if it's not empty
        if (inputValue.trim() !== "" && (!value || value.description !== inputValue.trim())) {
          const tempArticle: Article = {
            id: value?.id || "",
            tenantId: value?.tenantId || "",
            description: inputValue.trim(),
            quantity: value?.quantity || 0,
            createdAt: value?.createdAt || "",
            updatedAt: value?.updatedAt || "",
          };
          onChange(tempArticle);
        }
      }}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;
        return option.description || "";
      }}
      isOptionEqualToValue={(option, val) => {
        if (!val) return false;
        // If value has an ID, match by ID
        if (val.id && option.id) {
          return option.id === val.id;
        }
        // Otherwise, match by description (for freeSolo entries)
        return option.description === val.description;
      }}
      loading={isLoading}
      disabled={disabled}
      noOptionsText={inputValue.length < 2 ? "Type at least 2 characters" : "No articles found"}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <div className="flex flex-col">
            <span className="font-medium">{option.description}</span>
            <span className="text-sm text-gray-500">Quantity: {option.quantity}</span>
          </div>
        </li>
      )}
    />
  );
}
