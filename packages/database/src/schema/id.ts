/** Primary-key generator for domain tables. Auth tables keep better-auth's own ids. */
export const createId = () => crypto.randomUUID();
