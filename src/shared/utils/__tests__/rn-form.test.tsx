import { createFormControl } from 'react-hook-form';

import { toTextInputProps } from '@/shared/utils/rn-form';

type FormValues = { search: string };

describe('toTextInputProps', () => {
  it('el evento nativo de onChangeText llega a _formValues de react-hook-form', () => {
    const form = createFormControl<FormValues>({ defaultValues: { search: '' } });
    const inputProps = toTextInputProps(form.register('search'));

    inputProps.onChangeText('hola mundo');

    const control = form.control as unknown as { _formValues: FormValues };
    expect(control._formValues).toEqual({ search: 'hola mundo' });
    expect(form.getValues()).toEqual({ search: 'hola mundo' });
  });

  it('mantiene el name, el onBlur y el ref del registro', () => {
    const onBlur = jest.fn();
    const onChange = jest.fn();
    const ref = jest.fn();

    const props = toTextInputProps({ name: 'email', ref, onBlur, onChange });

    expect(props.name).toBe('email');
    expect(props.onBlur).toBe(onBlur);
    expect(props.ref).toBe(ref);
  });
});
