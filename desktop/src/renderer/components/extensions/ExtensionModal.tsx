/**
 * ExtensionModal — generic input modal triggered by extensions.
 *
 * Extensions call breadcrumb.window.showInputModal(schema) which sends
 * a schema to the renderer. This component renders it as a modal form.
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface ModalField {
  id: string;
  type: "text" | "textarea" | "select" | "images";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

interface ModalSchema {
  title: string;
  description?: string;
  fields: ModalField[];
  submitLabel?: string;
  cancelLabel?: string;
}

interface PendingModal {
  requestId: string;
  schema: ModalSchema;
}

export function ExtensionModal() {
  const [modal, setModal] = useState<PendingModal | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    const cleanup = window.breadcrumbAPI?.onExtensionShowModal?.((data) => {
      const schema = data.schema as ModalSchema;
      setModal({ requestId: data.requestId, schema });
      // Initialize default values
      const defaults: Record<string, unknown> = {};
      for (const field of schema.fields) {
        if (field.type === "images") {
          defaults[field.id] = [];
        } else if (field.type === "select" && field.options?.length) {
          defaults[field.id] = field.options[0].value;
        } else {
          defaults[field.id] = "";
        }
      }
      setValues(defaults);
    });
    return () => cleanup?.();
  }, []);

  // Focus first input when modal opens
  useEffect(() => {
    if (modal) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [modal]);

  const handleSubmit = useCallback(() => {
    if (!modal) return;
    window.breadcrumbAPI?.resolveExtensionModal(modal.requestId, values);
    setModal(null);
    setValues({});
  }, [modal, values]);

  const handleCancel = useCallback(() => {
    if (!modal) return;
    window.breadcrumbAPI?.resolveExtensionModal(modal.requestId, null);
    setModal(null);
    setValues({});
  }, [modal]);

  // Close on Escape
  useEffect(() => {
    if (!modal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, handleCancel]);

  if (!modal) return null;

  const { schema } = modal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />
      <div className="relative w-full max-w-xl glass border border-border-strong rounded-xl shadow-lg overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-foreground">
            {schema.title}
          </h2>
          {schema.description && (
            <p className="mt-1 text-2xs text-foreground-muted">
              {schema.description}
            </p>
          )}
        </div>

        {/* Fields */}
        <div className="px-5 pb-4 space-y-3">
          {schema.fields.map((field, idx) => (
            <div key={field.id}>
              <label className="block text-2xs font-medium text-foreground-secondary mb-1">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              {field.type === "text" && (
                <input
                  ref={idx === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                  type="text"
                  value={(values[field.id] as string) || ""}
                  onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 bg-background-raised border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-accent-secondary transition-colors"
                />
              )}
              {field.type === "textarea" && (
                <textarea
                  ref={idx === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                  value={(values[field.id] as string) || ""}
                  onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                  placeholder={field.placeholder}
                  rows={4}
                  className="w-full px-3 py-2 bg-background-raised border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-accent-secondary transition-colors resize-none"
                />
              )}
              {field.type === "select" && field.options && (
                <select
                  ref={idx === 0 ? (el) => { firstInputRef.current = el; } : undefined}
                  value={(values[field.id] as string) || ""}
                  onChange={(e) => setValues({ ...values, [field.id]: e.target.value })}
                  className="w-full px-3 py-2 bg-background-raised border border-border rounded-lg text-sm text-foreground outline-none focus:border-accent-secondary transition-colors"
                >
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              {field.type === "images" && (
                <div className="text-2xs text-foreground-muted italic">
                  Image field — implemented by debug modal override
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-2xs font-medium text-foreground-secondary hover:text-foreground rounded-md hover:bg-background-raised transition-colors"
          >
            {schema.cancelLabel || "Cancel"}
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-2xs font-medium text-white bg-accent-secondary hover:bg-accent-secondary/90 rounded-md transition-colors"
          >
            {schema.submitLabel || "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
