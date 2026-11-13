import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Button, TextField } from '@/components';
import { useTheme } from '@/theme';
import { autofill } from '@/lib/autofill';

import { PASSWORD_HELP, signUpSchema, type SignUpValues } from '../schemas';
import { FormError } from './FormError';

type Props = {
  submitLabel: string;
  busy: boolean;
  error: string | null;
  /** Shown under the error, e.g. "Log in instead" when the email already has an account. */
  errorAction?: React.ReactNode;
  onSubmit: (values: SignUpValues) => void;
  onChange?: () => void;
};

/** Name (optional), email and password with live zod validation. Submit stays disabled until valid. */
export function SignUpForm({ submitLabel, busy, error, errorAction, onSubmit, onChange }: Props) {
  const { spacing } = useTheme();
  const { control, handleSubmit, formState } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: { name: '', email: '', password: '' },
  });

  return (
    <View>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <TextField
            label="Name (optional)"
            value={field.value ?? ''}
            onChangeText={(t) => {
              field.onChange(t);
              onChange?.();
            }}
            onBlur={field.onBlur}
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            returnKeyType="next"
            error={fieldState.error?.message}
            testID="signup-name"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={(t) => {
              field.onChange(t);
              onChange?.();
            }}
            onBlur={field.onBlur}
            error={
              fieldState.isDirty || fieldState.isTouched ? fieldState.error?.message : undefined
            }
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            {...autofill('username')}
            returnKeyType="next"
            testID="signup-email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <TextField
            label="Password"
            secure
            value={field.value}
            onChangeText={(t) => {
              field.onChange(t);
              onChange?.();
            }}
            onBlur={field.onBlur}
            helper={PASSWORD_HELP}
            error={fieldState.isDirty ? fieldState.error?.message : undefined}
            autoCapitalize="none"
            autoCorrect={false}
            {...autofill('new-password')}
            returnKeyType="done"
            testID="signup-password"
          />
        )}
      />
      <FormError message={error} />
      {errorAction}
      <View style={{ marginTop: spacing.sm }}>
        <Button
          label={submitLabel}
          onPress={handleSubmit(onSubmit)}
          disabled={!formState.isValid}
          loading={busy}
          testID="signup-submit"
        />
      </View>
    </View>
  );
}
