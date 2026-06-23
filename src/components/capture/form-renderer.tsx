"use client";

import Form from "@rjsf/core";
import { customizeValidator } from "@rjsf/validator-ajv8";
import Ajv2020 from "ajv/dist/2020";
import type { RegistryFieldsType, RJSFSchema, UiSchema } from "@rjsf/utils";
import { Button } from "@/components/ui/button";
import { GeoPointField } from "./geo-point-field";
import { GeoPolygonField } from "./geo-polygon-field";

// Draft 2020-12 (if/then/allOf). strict:false so a `format` on an object field (our geo fields) and
// other harmless schema annotations don't throw.
const validator = customizeValidator({
  AjvClass: Ajv2020 as never,
  ajvOptionsOverrides: { strict: false },
});

const fields: RegistryFieldsType = {
  geoPoint: GeoPointField,
  geoPolygon: GeoPolygonField,
};

type Props = {
  schema: RJSFSchema;
  uiSchema: UiSchema;
  formData: unknown;
  onChange: (data: unknown) => void;
  onSubmit: (data: unknown) => void;
  submitting: boolean;
};

export function FormRenderer({ schema, uiSchema, formData, onChange, onSubmit, submitting }: Props) {
  return (
    <div className="locus-form">
      <Form
        schema={schema}
        uiSchema={uiSchema}
        formData={formData}
        validator={validator}
        fields={fields}
        showErrorList={false}
        onChange={(e) => onChange(e.formData)}
        onSubmit={(e) => onSubmit(e.formData)}
      >
        <div className="mt-4">
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Saving…" : "Save submission"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
