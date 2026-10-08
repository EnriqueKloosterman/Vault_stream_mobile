import type { UseFormRegisterReturn } from 'react-hook-form';

export function toTextInputProps(
  field: UseFormRegisterReturn,
  value?: string,
) {
  return {
    name: field.name,
    ref: field.ref,
    onBlur: field.onBlur,
    value,
    onChangeText: (text: string) =>
      field.onChange({
        target: { name: field.name, value: text },
        type: 'change',
      }),
  };
}
