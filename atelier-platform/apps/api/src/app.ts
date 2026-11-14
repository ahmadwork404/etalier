import { register as bookings } from "./modules/bookings.js";
import { register as contactLeads } from "./modules/contact-leads.js";
import { startLeadNotifications } from "./services/contact-leads.js";
import { register as payroll } from "./modules/payroll.js";
import { startPayrollScheduler } from "./services/payroll.js";
import { register as privacyPayroll } from "./modules/privacy-payroll.js";
import { captureRoutes, mountDocs } from "./docs.js";
import { logger } from "./logger.js";
import { register as purchasing } from "./modules/purchasing.js";
import { register as publicBooking } from "./modules/public-booking.js";
import { register as gateway } from "./modules/gateway.js";
import { register as retention } from "./modules/retention.js";
import { register as automation } from "./modules/automation.js";
import { register as engagement } from "./modules/engagement.js";
import { register as access } from "./modules/access.js";
import { register as management } from "./modules/management.js";
import { register as commerce } from "./modules/commerce.js";
import { register as appointments } from "./modules/appointments.js";
import { app, wrap, ok } from "./runtime.js";
import { pool } from "./db.js";
import { HttpError } from "./security.js";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { register as auth } from "./modules/auth.js";
import { register as tenants } from "./modules/tenants.js";
import { register as directories } from "./modules/directories.js";
import { register as platform } from "./modules/platform.js";
import { register as customerProfile } from "./modules/customer-profile.js";
import { register as customerPhotos } from "./modules/customer-photos.js";
import { register as customerInsights } from "./modules/customer-insights.js";
import { register as serviceInsights } from "./modules/service-insights.js";
import { register as serviceImages } from "./modules/service-images.js";
import { register as intakeForms } from "./modules/intake-forms.js";
import { register as employeeProfiles } from "./modules/employee-profiles.js";
import { register as locationProfiles } from "./modules/location-profiles.js";
import { register as quickWork } from "./modules/quick-work.js";
import { register as records } from "./modules/records.js";
const documentedRoutes = captureRoutes(app);
app.get(
  "/api/v1/health",
  wrap(async (_req, res) => {
    await pool.query("SELECT 1");
    ok(res, { status: "healthy" });
  }),
);

auth(app);
contactLeads(app);

tenants(app);
directories(app);
customerProfile(app);
customerPhotos(app);
customerInsights(app);
serviceInsights(app);
serviceImages(app);
intakeForms(app);
employeeProfiles(app);
quickWork(app);
locationProfiles(app);
records(app);
platform(app);
privacyPayroll(app);
payroll(app);
bookings(app);

purchasing(app);
publicBooking(app);
gateway(app);
retention(app);
automation(app);
engagement(app);
access(app);
management(app);
commerce(app);
appointments(app);
mountDocs(app, documentedRoutes);
app.use((_req, _res, next) => next(new HttpError(404, "Endpoint not found")));
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError)
    return res.status(422).json({
      error: { message: "Please check your input", issues: error.flatten() },
    });
  const status =
    error instanceof HttpError
      ? error.status
      : error.type === "entity.too.large"
        ? 413
        : error instanceof SyntaxError && (error as any).status === 400
          ? 400
          : error.code === "23505"
            ? 409
            : error.code === "23P01"
              ? 409
              : error.code === "23503"
                ? 422
                : 500;
  if (status === 500)
    logger.error(
      { code: error.code, message: error.message },
      "request_failed",
    );
  res.status(status).json({
    error: {
      message:
        error instanceof HttpError
          ? error.message
          : status === 413
            ? "This submission is too large. Shorten your answers and try again."
            : status === 400
              ? "Invalid request format."
              : status === 409
                ? "Record already exists or booking overlaps"
                : status === 422
                  ? "Related record is unavailable"
                  : "Unable to complete request",
    },
  });
});

export {app};
