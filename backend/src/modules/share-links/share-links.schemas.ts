import { z } from "zod";
import { USERNAME_PATTERN } from "../users/usernames.js";

export const shareLinkParams = z.object({ shareLinkId: z.uuid() });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Use 3-30 lowercase letters, digits or hyphens");

const linkPassword = z.string().min(8).max(100);
const contactChoice = (body: { showContact?: boolean | undefined; contactPassword?: string | null | undefined }) =>
  !(body.showContact && body.contactPassword);
const contactChoiceError = "Contacts are either shown or locked with a password, not both";

export const createShareLinkBody = z
  .object({
    slug: slugSchema.optional(),
    pinnedVersionId: z.uuid().nullable().default(null),
    showContact: z.boolean().default(false),
    isListed: z.boolean().default(false),
    password: linkPassword.optional(),
    // Paid: contacts stay hidden until a visitor enters this password.
    contactPassword: linkPassword.optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine(contactChoice, contactChoiceError);

export const updateShareLinkBody = z
  .object({
    slug: slugSchema.optional(),
    pinnedVersionId: z.uuid().nullable().optional(),
    showContact: z.boolean().optional(),
    isListed: z.boolean().optional(),
    password: linkPassword.nullable().optional(),
    contactPassword: linkPassword.nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Provide at least one field to update")
  .refine(contactChoice, contactChoiceError);

export const shareLinkResponse = z.object({
  id: z.uuid(),
  resumeId: z.uuid(),
  slug: z.string(),
  url: z.url(),
  pinnedVersionId: z.uuid().nullable(),
  showContact: z.boolean(),
  isListed: z.boolean(),
  hasPassword: z.boolean(),
  hasContactPassword: z.boolean(),
  expiresAt: z.date().nullable(),
  viewCount: z.number().int(),
  lastViewedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const shareLinkListResponse = z.array(shareLinkResponse);

export const shareLinkStatsResponse = z.object({
  viewCount: z.number().int(),
  uniqueVisitors: z.number().int(),
  lastViewedAt: z.date().nullable(),
  viewsByDay: z.array(z.object({ day: z.string(), views: z.number().int() })),
  topReferrers: z.array(z.object({ referrer: z.string(), views: z.number().int() })),
  countries: z.array(z.object({ country: z.string(), views: z.number().int() })),
  places: z.array(
    z.object({
      city: z.string().nullable(),
      region: z.string().nullable(),
      country: z.string().nullable(),
      views: z.number().int(),
    }),
  ),
});
