import { Field, FieldAttributes } from 'formik';
import { ChangeEvent, InputHTMLAttributes } from 'react';

const defaultInputClasses =
  'w-full py-2 px-3 border border-border rounded-card focus:outline-none transition-colors duration-200';

export function TextField({ classes, ...props }: FieldAttributes<{ classes: string }>) {
  return <Field className={`${defaultInputClasses} ${classes}`} {...props} />;
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  onChange: (v: string) => void;
  classes?: string;
  error?: boolean;
};

export function TextInput({
  onChange,
  classes,
  error,
  ...props
}: InputProps & { error?: boolean }) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e?.target?.value || '');
  };
  return (
    <input
      id={props.name}
      type="text"
      className={`${defaultInputClasses} ${error ? 'border-red-500' : 'border-border'} ${classes}`}
      name={props.name}
      value={props.value}
      autoComplete="off"
      onChange={handleChange}
      {...props}
    />
  );
}
