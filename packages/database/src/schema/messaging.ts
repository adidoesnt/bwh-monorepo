import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "./id";
import { user } from "./auth";

export type ChatSender = "user" | "bot" | "coach";

/** One message in a client's help/support thread with the habit assistant. */
export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    clientId: text("client_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sender: text("sender").$type<ChatSender>().notNull(),
    body: text("body").notNull(),
    /** Set when a message was escalated to the client's coach. */
    escalatedAt: timestamp("escalated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_message_clientId_createdAt_idx").on(
      table.clientId,
      table.createdAt,
    ),
  ],
);

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  client: one(user, {
    fields: [chatMessage.clientId],
    references: [user.id],
  }),
}));
