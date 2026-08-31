import * as authSchema from "./auth";
import * as coachingSchema from "./coaching";
import * as bookingSchema from "./booking";
import * as billingSchema from "./billing";
import * as healthSchema from "./health";
import * as messagingSchema from "./messaging";

export * from "./auth";
export * from "./coaching";
export * from "./booking";
export * from "./billing";
export * from "./health";
export * from "./messaging";

const schema = {
  ...authSchema,
  ...coachingSchema,
  ...bookingSchema,
  ...billingSchema,
  ...healthSchema,
  ...messagingSchema,
};

export default schema;
