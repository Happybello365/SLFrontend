import { z } from 'zod';

export const deleteAccountSchema = z.object({
  understood: z
    .boolean()
    .refine((v) => v === true, { message: 'Please confirm that you understand.' }),
  password: z.string().min(1, 'Current password is required.'),
});

export type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;
