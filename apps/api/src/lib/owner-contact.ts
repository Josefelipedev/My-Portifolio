// The repo is public, so the owner's phone and home address are not committed.
// The server supplies them through OWNER_PHONE / OWNER_ADDRESS, and only
// owner-facing reads (the admin editor, CV checks) merge them in.

export interface OwnerContact {
  phone: string;
  address: string;
}

function pick(value: unknown, fallback: string | undefined): string {
  return (typeof value === 'string' && value.trim()) || fallback?.trim() || '';
}

/** Fill in the phone and address from the server env when the data has none. */
export function withOwnerContact<T extends object>(personalInfo: T): T & OwnerContact {
  const info = personalInfo as Record<string, unknown>;
  return {
    ...personalInfo,
    phone: pick(info.phone, process.env.OWNER_PHONE),
    address: pick(info.address, process.env.OWNER_ADDRESS),
  };
}
