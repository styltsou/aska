import {
  getGettingStartedTour,
  updateGettingStartedTour,
} from "@/controllers/onboarding-tour.controller";
import { factory } from "@/factory";

const onboardingTourRoutes = factory
  .createApp()
  .get("/me/onboarding-tour", ...getGettingStartedTour)
  .post("/me/onboarding-tour/events", ...updateGettingStartedTour);

export default onboardingTourRoutes;
