import type { PageData } from "./$types";

export const isClient = (data: PageData) => data.user.role === 'client';
