import type { UseFormRegisterReturn } from 'react-hook-form';

export function toTextInputProps(field: UseFormRegisterReturn) {
  return {
    name: field.name,
    ref: field.ref,
    onBlur: field.onBlur,
    onChangeText: (text: string) =>
      field.onChange({
        target: { name: field.name, value: text },
        type: 'change',
      }),
  };
}
