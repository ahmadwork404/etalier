import {app} from "./app.js";
import {pool} from "./db.js";
import {startLeadNotifications} from "./services/contact-leads.js";
import {startPayrollScheduler} from "./services/payroll.js";
startLeadNotifications();
startPayrollScheduler();
const server = app.listen(
  Number(process.env.PORT || 4000),
  process.env.HOST || "127.0.0.1",
  () => console.log("Atelier API ready on port " + (process.env.PORT || 4000)),
);
process.on("SIGTERM", () => server.close(() => pool.end()));
