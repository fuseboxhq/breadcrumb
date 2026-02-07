# Golden Reference Version: 1.0
# Created: 2026-02-07
# Last Validated: 2026-02-07
# Expires: 2026-08-07

# Research: React Form Validation Library

**Task ID:** eval-golden-001
**Date:** 2026-02-07
**Domain:** React form management and validation
**Overall Confidence:** HIGH

## TL;DR

Use **React Hook Form + Zod** for form validation in React applications. React Hook Form provides performant, uncontrolled-component-based form management with minimal re-renders, and Zod gives you TypeScript-first schema validation that infers types automatically. Together they eliminate boilerplate, give you end-to-end type safety, and handle every form pattern from simple login screens to multi-step wizards.

## Recommended Stack

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| react-hook-form | 7.54.x | Form state management, submission, field registration | HIGH |
| @hookform/resolvers | 3.9.x | Bridge between RHF and Zod schema validation | HIGH |
| zod | 3.23.x | Schema declaration and validation with TypeScript inference | HIGH |

**Install:**
```bash
npm install react-hook-form @hookform/resolvers zod
```

## Key Patterns

### Basic Form with Zod Schema
**Use when:** Any form with typed fields and validation rules.
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    await api.login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} placeholder="Email" />
      {errors.email && <span>{errors.email.message}</span>}

      <input {...register('password')} type="password" />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit" disabled={isSubmitting}>Log In</button>
    </form>
  );
}
```

### Multi-Step Wizard Form
**Use when:** Forms that span multiple pages/steps with shared state.
```tsx
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const wizardSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email(),
  plan: z.enum(['free', 'pro', 'enterprise']),
  billingAddress: z.string().optional(),
});

type WizardForm = z.infer<typeof wizardSchema>;

export function Wizard() {
  const methods = useForm<WizardForm>({
    resolver: zodResolver(wizardSchema),
    mode: 'onBlur', // Validate each step on blur
  });
  const [step, setStep] = useState(0);

  return (
    <FormProvider {...methods}>
      {step === 0 && <StepOne onNext={() => setStep(1)} />}
      {step === 1 && <StepTwo onNext={() => setStep(2)} onBack={() => setStep(0)} />}
      {step === 2 && <StepThree onBack={() => setStep(1)} />}
    </FormProvider>
  );
}

function StepOne({ onNext }: { onNext: () => void }) {
  const { register, trigger, formState: { errors } } = useFormContext<WizardForm>();

  const handleNext = async () => {
    const valid = await trigger(['name', 'email']); // Validate only step 1 fields
    if (valid) onNext();
  };

  return (
    <div>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      <button onClick={handleNext}>Next</button>
    </div>
  );
}
```

### Dynamic Field Arrays
**Use when:** Forms with add/remove rows (e.g., line items, team members).
```tsx
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const invoiceSchema = z.object({
  items: z.array(z.object({
    description: z.string().min(1, 'Required'),
    quantity: z.coerce.number().min(1),
    price: z.coerce.number().min(0),
  })).min(1, 'Add at least one item'),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

export function InvoiceEditor() {
  const { control, register, handleSubmit } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { items: [{ description: '', quantity: 1, price: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`items.${index}.description`)} />
          <input {...register(`items.${index}.quantity`)} type="number" />
          <input {...register(`items.${index}.price`)} type="number" />
          <button type="button" onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => append({ description: '', quantity: 1, price: 0 })}>
        Add Item
      </button>
      <button type="submit">Save</button>
    </form>
  );
}
```

### Server-Side Validation Errors
**Use when:** API returns field-level errors that need to display inline.
```tsx
const onSubmit = async (data: LoginForm) => {
  try {
    await api.register(data);
  } catch (err) {
    if (err.fieldErrors) {
      Object.entries(err.fieldErrors).forEach(([field, message]) => {
        setError(field as keyof LoginForm, { type: 'server', message: message as string });
      });
    }
  }
};
```

## Don't Hand-Roll

| Problem | Use Instead | Why |
|---------|-------------|-----|
| Manual `useState` per field | `useForm` + `register` | Eliminates re-render cascades; RHF uses refs internally |
| Regex-based email validation | `z.string().email()` | Covers edge cases you will miss (RFC 5322 compliance) |
| Custom debounced async validation | RHF `mode: 'onBlur'` + Zod `.refine()` | Handles race conditions, cancellation, loading state |
| Hand-coded error message mapping | Zod schema `.message()` | Co-locates rules with messages; single source of truth |
| Manual dirty/touched tracking | `formState.dirtyFields` / `touchedFields` | RHF tracks per-field state with zero boilerplate |

## Pitfalls

### Forgetting `z.coerce` for Number Inputs
**What happens:** HTML inputs always return strings. Without `z.coerce.number()`, Zod rejects numeric fields because it receives `"42"` (string) instead of `42` (number). Your form silently fails validation with a confusing "expected number, received string" error.
**Avoid by:** Always use `z.coerce.number()` instead of `z.number()` for any `<input type="number">` field. This tells Zod to cast the string to a number before validating.

### Using `mode: 'onChange'` on Large Forms
**What happens:** Zod re-validates the entire schema on every keystroke. For forms with 20+ fields or expensive async refinements, this causes noticeable input lag (~50-100ms per keystroke).
**Avoid by:** Use `mode: 'onBlur'` (validates when user leaves a field) or `mode: 'onSubmit'` (validates only on submit). Reserve `onChange` for small forms (under 10 fields) where instant feedback is critical.

### Not Handling Zod `.refine()` Async Errors
**What happens:** If you use `.refine(async (val) => checkUnique(val))` for uniqueness checks but don't handle network failures, the form hangs with no error displayed. The user is stuck.
**Avoid by:** Wrap async refinements in try/catch and return `false` on failure. Always set a timeout. Consider using `superRefine` for better error control.

## Open Questions

None -- React Hook Form + Zod is the consensus standard for React form validation as of 2026. The only decision point is whether your project also needs a form UI component library (e.g., shadcn/ui Form components), which is an orthogonal choice.

## Sources

**HIGH confidence:**
- [React Hook Form Docs](https://react-hook-form.com/) - Official API reference, performance benchmarks, resolver setup
- [Zod Docs](https://zod.dev/) - Schema API, TypeScript inference, coerce utilities
- [@hookform/resolvers GitHub](https://github.com/react-hook-form/resolvers) - Zod resolver integration, version compatibility

**MEDIUM confidence:**
- [React Hook Form vs Formik benchmark](https://react-hook-form.com/faqs#performanceofReactHookForm) - Re-render comparison data showing RHF 3-5x fewer renders
- [Zod + RHF patterns on GitHub discussions](https://github.com/react-hook-form/react-hook-form/discussions) - Community patterns for multi-step forms, dynamic arrays
- [shadcn/ui Form component](https://ui.shadcn.com/docs/components/form) - Built on RHF + Zod, validates this stack choice
