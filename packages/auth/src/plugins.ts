import { stripe } from "@better-auth/stripe";
import { apiKey, genericOAuth } from "better-auth/plugins";
import { magicLink } from "better-auth/plugins/magic-link";

import type { dbClient } from "@banana/db/client";
import * as memberRepo from "@banana/db/repository/member.repo";
import * as subscriptionRepo from "@banana/db/repository/subscription.repo";
import * as userRepo from "@banana/db/repository/user.repo";
import * as workspaceRepo from "@banana/db/repository/workspace.repo";
import { sendEmail } from "@banana/email";
import { createLogger } from "@banana/logger";
import { generateUID } from "@banana/shared/utils";

const log = createLogger("auth");
import { createStripeClient } from "@banana/stripe";

import { socialProvidersPlugin } from "./providers";
import { triggerWorkflow } from "./utils";

export function createPlugins(db: dbClient) {
  return [
    socialProvidersPlugin(),
    ...(process.env.NEXT_PUBLIC_KAN_ENV === "cloud"
      ? [
          stripe({
            stripeClient: createStripeClient(),
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
            createCustomerOnSignUp: true,
            subscription: {
              enabled: true,
              plans: [
                {
                  name: "team",
                  priceId: process.env.STRIPE_TEAM_PLAN_MONTHLY_PRICE_ID!,
                  annualDiscountPriceId:
                    process.env.STRIPE_TEAM_PLAN_YEARLY_PRICE_ID!,
                  freeTrial: {
                    days: 14,
                    onTrialStart: async (subscription) => {
                      await triggerWorkflow(db, "trial-start", subscription);
                    },
                    onTrialEnd: async ({ subscription }) => {
                      await triggerWorkflow(db, "trial-end", subscription);
                    },
                    onTrialExpired: async (subscription) => {
                      await triggerWorkflow(db, "trial-expired", subscription);
                    },
                  },
                },
                {
                  name: "pro",
                  priceId: process.env.STRIPE_PRO_PLAN_MONTHLY_PRICE_ID!,
                  annualDiscountPriceId:
                    process.env.STRIPE_PRO_PLAN_YEARLY_PRICE_ID!,
                  freeTrial: {
                    days: 14,
                    onTrialStart: async (subscription) => {
                      await triggerWorkflow(db, "trial-start", subscription);
                    },
                    onTrialEnd: async ({ subscription }) => {
                      await triggerWorkflow(db, "trial-end", subscription);
                    },
                    onTrialExpired: async (subscription) => {
                      await triggerWorkflow(db, "trial-expired", subscription);
                    },
                  },
                },
              ],
              authorizeReference: async (data) => {
                const workspace = await workspaceRepo.getByPublicId(
                  db,
                  data.referenceId,
                );

                if (!workspace) {
                  return Promise.resolve(false);
                }

                const isUserInWorkspace = await workspaceRepo.isUserInWorkspace(
                  db,
                  data.user.id,
                  workspace.id,
                );

                return isUserInWorkspace;
              },
              getCheckoutSessionParams: () => {
                return {
                  params: {
                    allow_promotion_codes: true,
                  },
                };
              },
              onSubscriptionComplete: async ({
                subscription,
                stripeSubscription,
              }) => {
                // Set unlimited seats to true for pro plans
                if (subscription.plan === "pro") {
                  await subscriptionRepo.updateByStripeSubscriptionId(
                    db,
                    stripeSubscription.id,
                    {
                      unlimitedSeats: true,
                    },
                  );
                  log.info({ subscriptionId: stripeSubscription.id }, "Pro subscription activated with unlimited seats");

                  const workspace = await workspaceRepo.getByPublicId(
                    db,
                    subscription.referenceId,
                  );

                  if (workspace?.id) {
                    await memberRepo.unpauseAllMembers(db, workspace.id);
                  }
                }
              },
              onSubscriptionCancel: async ({
                subscription,
                cancellationDetails,
              }) => {
                await triggerWorkflow(
                  db,
                  "subscription-canceled",
                  subscription,
                  cancellationDetails,
                );

                // for cancelled subscriptions, we need to pause all members and set their workspace plan to free
                const workspace = await workspaceRepo.getByPublicId(
                  db,
                  subscription.referenceId,
                );

                if (workspace?.id) {
                  await memberRepo.pauseAllMembers(db, workspace.id);

                  // Reset slug to publicId, or generate a UID if publicId is taken
                  let newSlug = workspace.publicId;

                  if (workspace.slug !== workspace.publicId) {
                    const isPublicIdAvailable =
                      await workspaceRepo.isWorkspaceSlugAvailable(
                        db,
                        workspace.publicId,
                      );
                    if (!isPublicIdAvailable) {
                      newSlug = generateUID();
                    }
                  }

                  await workspaceRepo.update(db, subscription.referenceId, {
                    plan: "free",
                    slug: newSlug,
                  });
                }
              },
              onSubscriptionUpdate: async ({ subscription }) => {
                await triggerWorkflow(db, "subscription-updated", subscription);
              },
            },
          }),
        ]
      : []),
    apiKey({
      enableSessionForAPIKeys: true,
      customAPIKeyGetter: (ctx) => {
        const authorization = ctx.headers?.get("authorization");
        if (authorization?.startsWith("Bearer ")) {
          return authorization.slice(7);
        }
        return ctx.headers?.get("x-api-key") ?? null;
      },
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60, // 1 minute
        maxRequests: 100, // 100 requests per minute
      },
    }),
    magicLink({
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      sendMagicLink: async ({ email, url }) => {
        try {
          const decodedUrl = decodeURIComponent(url);
          log.info({ email, isInvite: decodedUrl.includes("type=invite") }, "Sending magic link");
          if (decodedUrl.includes("type=invite")) {
            let inviterName = "";
            let workspaceName = "";

            try {
              const urlObj = new URL(url);
              const callbackUrl = urlObj.searchParams.get("callbackURL");
              if (callbackUrl) {
                const callbackParams = new URL(
                  callbackUrl,
                  process.env.NEXT_PUBLIC_BASE_URL,
                ).searchParams;
                const memberPublicId = callbackParams.get("memberPublicId");

                if (memberPublicId) {
                  const member = await memberRepo.getByPublicId(
                    db,
                    memberPublicId,
                  );
                  if (member) {
                    const [workspace, inviter] = await Promise.all([
                      workspaceRepo.getById(db, member.workspaceId),
                      userRepo.getById(db, member.createdBy),
                    ]);

                    if (workspace) workspaceName = workspace.name;
                    if (inviter) inviterName = inviter.name ?? "";
                  }
                }
              }
            } catch (error) {
              log.error({ err: error }, "Failed to fetch invite details");
            }

            await sendEmail(
              email,
              workspaceName
                ? `Invitation to join the workspace ${workspaceName}`
                : "Invitation to join workspace",
              "JOIN_WORKSPACE",
              {
                magicLoginUrl: url,
                inviterName,
                workspaceName,
              },
            );
          } else {
            await sendEmail(
              email,
              process.env.NEXT_PUBLIC_WHITE_LABEL_HIDE_POWERED_BY === "true"
                ? "Sign in to your account"
                : "Sign in to Kan",
              "MAGIC_LINK",
              {
                magicLoginUrl: url,
              },
            );
          }
        } catch (error) {
          log.error({ err: error, email }, "Error sending magic link");
        }
      },
    }),
    // Generic OIDC provider
    ...(process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.OIDC_AUTHORIZATION_URL
      ? [
          genericOAuth({
            config: [
              {
                providerId: "oidc",
                clientId: process.env.OIDC_CLIENT_ID,
                clientSecret: process.env.OIDC_CLIENT_SECRET,
                authorizationUrl: process.env.OIDC_AUTHORIZATION_URL,
                tokenUrl: process.env.OIDC_TOKEN_URL,
                scopes: ["openid", "email", "profile"],
                pkce: true,
                getUserInfo: async (tokens) => {
                  const res = await fetch(
                    process.env.OIDC_USER_INFO_URL!,
                    {
                      headers: { Authorization: `Bearer ${tokens.accessToken!}` },
                    },
                  );
                  if (!res.ok) {
                    log.error({ status: res.status, statusText: res.statusText }, "Failed to fetch user info");
                    return null;
                  }
                  const profile = (await res.json()) as Record<string, unknown>;
                  log.debug({ profile }, "OIDC profile received");

                  return {
                    id: ((profile.id ?? profile.sub) as string) || "",
                    email: (profile.email as string) || "",
                    name:
                      ((profile.name || profile.display_name || profile.nickname || profile.username || [profile.first_name, profile.last_name].filter(Boolean).join(" ")) as string) ||
                      "",
                    emailVerified: (profile.email_verified as boolean) ?? false,
                    image: ((profile.picture ?? profile.avatar) as string) || undefined,
                  };
                },
              },
            ],
          }),
        ]
      : []),
  ];
}
