import { z } from 'zod';

export const PASSWORD_HELP = 'At least 8 characters, including a number';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email')
  .pipe(z.email('Enter a valid email address'));

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters with a number')
  .regex(/\d/, 'Use at least 8 characters with a number');

export const signUpSchema = z.object({
  name: z.string().trim().max(60, 'Keep your name under 60 characters').optional(),
  email: emailSchema,
  password: passwordSchema,
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const forgotSchema = z.object({ email: emailSchema });

export type SignUpValues = z.infer<typeof signUpSchema>;
export type LogInValues = z.infer<typeof logInSchema>;
export type ForgotValues = z.infer<typeof forgotSchema>;
