import { OnboardingTourEventSchema } from "@/dto/onboarding-tour.dto";
import { factory } from "@/factory";
import { success } from "@/lib/response";
import { authMiddleware } from "@/middleware";
import { validate } from "@/middleware/validate";
import {
  getOnboardingTour,
  recordOnboardingTourEvent,
} from "@/services/onboarding-tour.service";

export const getGettingStartedTour = factory.createHandlers(
  authMiddleware,
  async (c) => {
    c.header("Cache-Control", "no-store");
    return c.json(success(await getOnboardingTour(c.get("userId"))));
  },
);

export const updateGettingStartedTour = factory.createHandlers(
  authMiddleware,
  validate.body(OnboardingTourEventSchema),
  async (c) => {
    c.header("Cache-Control", "no-store");
    const state = await recordOnboardingTourEvent(
      c.get("userId"),
      c.req.valid("json"),
    );
    return c.json(success(state));
  },
);
