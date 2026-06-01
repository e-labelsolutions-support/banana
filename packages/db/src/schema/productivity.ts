import { relations } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  pgTable,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

// ─── Energy Check-In ─────────────────────────────────────────────────────────
// One check-in per user per day. Tracks mood/energy (1-5) for the
// "Energise" pillar of Feel Good Productivity.

export const userEnergyCheckin = pgTable(
  "user_energy_checkin",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    energyLevel: smallint("energyLevel").notNull(), // 1-5
    note: varchar("note", { length: 280 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    uniqueIndex("user_energy_checkin_user_date_idx").on(
      table.userId,
      table.date,
    ),
  ],
).enableRLS();

export const userEnergyCheckinRelations = relations(
  userEnergyCheckin,
  ({ one }) => ({
    user: one(users, {
      fields: [userEnergyCheckin.userId],
      references: [users.id],
      relationName: "energyCheckinUser",
    }),
  }),
);

// ─── Daily Quests ────────────────────────────────────────────────────────────
// Three micro-actions per day (Health, Work, Relationships) for the
// "Unblock" pillar. NICE goals — near-term, input-based, controllable, energising.

export const userDailyQuest = pgTable(
  "user_daily_quest",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    category: varchar("category", { length: 20 }).notNull(), // "health" | "work" | "relationships"
    action: varchar("action", { length: 200 }).notNull(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    uniqueIndex("user_daily_quest_user_date_cat_idx").on(
      table.userId,
      table.date,
      table.category,
    ),
    index("user_daily_quest_user_date_idx").on(table.userId, table.date),
  ],
).enableRLS();

export const userDailyQuestRelations = relations(
  userDailyQuest,
  ({ one }) => ({
    user: one(users, {
      fields: [userDailyQuest.userId],
      references: [users.id],
      relationName: "dailyQuestUser",
    }),
  }),
);

// ─── Wins ────────────────────────────────────────────────────────────────────
// "Find the Win" daily celebration log. Part of the "Sustain" pillar —
// tracking positive moments builds the Power energiser.

export const userWin = pgTable(
  "user_win",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    text: varchar("text", { length: 500 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    index("user_win_user_date_idx").on(table.userId, table.date),
    index("user_win_user_created_idx").on(table.userId, table.createdAt),
  ],
).enableRLS();

export const userWinRelations = relations(userWin, ({ one }) => ({
  user: one(users, {
    fields: [userWin.userId],
    references: [users.id],
    relationName: "winUser",
  }),
}));

// ─── Side Quests ─────────────────────────────────────────────────────────────
// Low-pressure curiosity tracker for the Play energiser.
// No deadlines, no daily reset — just tracking what sparks interest.

export const userSideQuest = pgTable(
  "user_side_quest",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: varchar("text", { length: 200 }).notNull(),
    explored: boolean("explored").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt"),
    exploredAt: timestamp("exploredAt"),
  },
  (table) => [
    index("user_side_quest_user_explored_idx").on(
      table.userId,
      table.explored,
      table.createdAt,
    ),
  ],
).enableRLS();

export const userSideQuestRelations = relations(
  userSideQuest,
  ({ one }) => ({
    user: one(users, {
      fields: [userSideQuest.userId],
      references: [users.id],
      relationName: "sideQuestUser",
    }),
  }),
);
