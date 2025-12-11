"use client";

import { IconButton } from "@mui/material";
import type {
  Control,
  FieldArrayWithId,
  UseFieldArrayReturn,
  UseFormSetValue,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";
import { IoAdd, IoTrash } from "react-icons/io5";
import type { Article } from "~/domain/entities/article";
import ArticleAutocomplete from "./article-autocomplete";
import { FormNumber } from "./form";

interface SalesOrderLineItemsProps {
  control: Control<any>;
  fields: FieldArrayWithId<any, "articles", "id">[];
  append: UseFieldArrayReturn<any, "articles">["append"];
  remove: UseFieldArrayReturn<any, "articles">["remove"];
  setValue: UseFormSetValue<any>;
  errors?: any;
}

export default function SalesOrderLineItems({
  control,
  fields,
  append,
  remove,
  setValue,
  errors,
}: SalesOrderLineItemsProps) {
  const articles = useWatch({ control, name: "articles" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Articles</h3>
        <IconButton
          onClick={() => append({ articleId: null, articleDescription: null, articleQuantity: 0 })}
          className="bg-[#6C63FF] text-white hover:bg-[#5a52e6]"
          size="small"
        >
          <IoAdd />
        </IconButton>
      </div>

      {fields.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
          No articles added. Click the + button to add an article.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {fields.map((field, index) => {
            const articleId = articles?.[index]?.articleId;
            const articleDescription = articles?.[index]?.articleDescription;
            const articleQuantity = articles?.[index]?.articleQuantity;

            return (
              <div
                key={field.id}
                className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex-1">
                  <Controller
                    name={`articles.${index}`}
                    control={control}
                    render={({ field: articleField }) => {
                      // Create Article object if we have a description (even without ID, for freeSolo display)
                      const currentArticle: Article | null =
                        articleDescription && articleDescription.trim() !== ""
                          ? {
                              id: articleId || "", // Use empty string if no ID (for freeSolo)
                              tenantId: "",
                              description: articleDescription,
                              quantity:
                                articleQuantity &&
                                articleQuantity !== null &&
                                articleQuantity !== ""
                                  ? Number(articleQuantity)
                                  : 0,
                              createdAt: "",
                              updatedAt: "",
                            }
                          : null;

                      return (
                        <ArticleAutocomplete
                          value={currentArticle}
                          onChange={(article) => {
                            if (article) {
                              // When article is selected, auto-fill articleQuantity with article's quantity
                              const quantity = article.quantity ?? 0;
                              const quantityString = quantity.toString();

                              // Update the entire article object
                              articleField.onChange({
                                articleId:
                                  article.id && article.id.trim() !== "" ? article.id : null,
                                articleDescription: article.description || null,
                                articleQuantity: quantityString, // Convert to string to match schema
                              });

                              // Explicitly update the articleQuantity field to ensure FormNumber updates
                              setValue(`articles.${index}.articleQuantity`, quantityString, {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                            } else {
                              // When article is cleared, reset all fields
                              articleField.onChange({
                                articleId: null,
                                articleDescription: null,
                                articleQuantity: null,
                              });

                              // Explicitly clear the articleQuantity field
                              setValue(`articles.${index}.articleQuantity`, null, {
                                shouldValidate: true,
                                shouldDirty: true,
                              });
                            }
                          }}
                          error={!!errors?.articles?.[index]?.articleDescription}
                          helperText={errors?.articles?.[index]?.articleDescription?.message}
                          label="Article Description"
                        />
                      );
                    }}
                  />
                </div>
                <div className="w-32">
                  <FormNumber
                    label="Article Quantity"
                    name={`articles.${index}.articleQuantity`}
                    control={control}
                    error={!!errors?.articles?.[index]?.articleQuantity}
                    helperText={errors?.articles?.[index]?.articleQuantity?.message}
                  />
                </div>
                <IconButton
                  onClick={() => remove(index)}
                  className="text-red-600 hover:bg-red-50"
                  size="small"
                >
                  <IoTrash />
                </IconButton>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
