// Staff roles (enforced by the API; see api/_auth.ts). Labels as shown in the app.

export type Role = 'super_admin' | 'hq' | 'campus';

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super admin',
  hq: 'HQ',
  campus: 'Campus team',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Every campus. Manages HQ and campus staff.',
  hq: 'Every campus. Can add, change and remove HQ and campus staff.',
  campus: 'Only the campuses chosen below. Cannot manage staff.',
};
