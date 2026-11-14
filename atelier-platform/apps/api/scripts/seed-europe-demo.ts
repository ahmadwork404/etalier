import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { demoPhotos, europeanDemoPlan } from "./europe-demo-plan.js";

// Preview is deliberately offline. Only --apply connects to PostgreSQL/R2.
const plan = europeanDemoPlan();
const root = new URL("../../../", import.meta.url);
const summary = {
  salon: plan.salon,
  locations: plan.locations.length,
  employees: plan.employees.length,
  customers: plan.customers.length,
  services: plan.services.length,
  appointments: plan.appointments.length,
  quickVisits: plan.quickVisits.length,
  leave: plan.leaves.length,
  photos: demoPhotos.length,
  today: plan.today,
};
if (!process.argv.includes("--apply")) {
  await mkdir(new URL(".qa/", root), { recursive: true });
  await writeFile(
    new URL(".qa/europe-demo-preview.json", root),
    JSON.stringify({ summary, plan, photos: demoPhotos }, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        previewOnly: true,
        ...summary,
        apply: "npm run demo:europe -w @atelier/api -- --apply",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const { pool, scoped } = await import("../src/db.js");
const { storage } = await import("../src/services/storage.js");
const { PutObjectCommand, DeleteObjectCommand } =
  await import("@aws-sdk/client-s3");
const { validServiceImage } = await import("../src/services/service-image.js");
const { calculatePayroll, generatePayroll } =
  await import("../src/services/payroll.js");
const fixture = JSON.parse(
  await readFile(new URL(".qa/qa-access.json", root), "utf8"),
);
if (
  fixture.syntheticDataOnly !== true ||
  !/^[\da-f-]{36}$/i.test(fixture.salonId)
)
  throw Error(
    "This script only refreshes the explicitly marked synthetic QA salon.",
  );
if (
  !["localhost", "127.0.0.1", "::1"].includes(
    process.env.DB_HOST || "localhost",
  )
)
  throw Error("Demo refresh is restricted to the local database.");
const tenant = fixture.salonId;
const target = (
  await pool.query("SELECT id,name,slug FROM tenants WHERE id=$1", [tenant])
).rows[0];
if (
  !target ||
  !(/^atelier-qa-\d+$/.test(target.slug) || target.slug === "maison-elan-demo")
)
  throw Error(
    "The target does not match the synthetic QA salon. No records changed.",
  );
const client = storage(),
  Bucket = process.env.R2_BUCKET,
  run = randomUUID(),
  uploaded: string[] = [];
const images = new Map<string, Buffer>();
let committed = false;
try {
  // Download and validate every required asset before touching existing records.
  for (const photo of demoPhotos) {
    const path = new URL(".qa/europe-demo-images/" + photo.key + ".jpg", root);
    await mkdir(new URL(".qa/europe-demo-images/", root), { recursive: true });
    let bytes: Buffer;
    try {
      bytes = await readFile(path);
    } catch {
      const url = `https://images.unsplash.com/photo-${photo.image}?fm=jpg&fit=crop&w=${photo.key === "marais" || photo.key === "rive-gauche" ? 1000 : 480}&q=80`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error("Image download failed: " + photo.key);
      bytes = Buffer.from(await response.arrayBuffer());
      await writeFile(path, bytes);
    }
    if (!validServiceImage(bytes, "image/jpeg"))
      throw Error("Invalid photo: " + photo.key);
    images.set(photo.key, bytes);
  }
  await mkdir(new URL("backups/", root), { recursive: true });
  await scoped(tenant, async (c) => {
    await c.query("SELECT id FROM tenants WHERE id=$1 FOR UPDATE", [tenant]);
    await c.query(
      "SELECT id FROM employees WHERE tenant_id=$1 ORDER BY id FOR UPDATE",
      [tenant],
    );
    const preserved = new Set([
      "tenant_features",
      "memberships",
      "roles",
      "sessions",
      "audit_logs",
      "branches",
    ]);
    const tables = (
      await c.query(
        "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' ORDER BY table_name",
      )
    ).rows
      .map((row) => row.table_name as string)
      .filter((name) => /^[a-z_]+$/.test(name) && !preserved.has(name));
    const backup: any = {
      created_at: new Date().toISOString(),
      syntheticDataOnly: true,
      tenant: (await c.query("SELECT * FROM tenants WHERE id=$1", [tenant]))
        .rows[0],
      branches: (
        await c.query("SELECT * FROM branches WHERE tenant_id=$1", [tenant])
      ).rows,
      tables: {},
    };
    for (const table of tables)
      backup.tables[table] = (
        await c.query(`SELECT * FROM ${table} WHERE tenant_id=$1`, [tenant])
      ).rows;
    await writeFile(
      new URL("backups/europe-demo-before-" + run + ".json", root),
      JSON.stringify(backup),
    );
    await c.query(
      "UPDATE customers SET photo_media_id=NULL WHERE tenant_id=$1",
      [tenant],
    );
    const edges = (
      await c.query(
        "SELECT child.relname child,parent.relname parent FROM pg_constraint fk JOIN pg_class child ON child.oid=fk.conrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace JOIN pg_class parent ON parent.oid=fk.confrelid WHERE fk.contype='f' AND ns.nspname='public'",
      )
    ).rows;
    const remaining = new Set<string>(tables),
      ordered: string[] = [];
    while (remaining.size) {
      const next = [...remaining].filter(
        (parent) =>
          !edges.some(
            (edge) =>
              edge.parent === parent &&
              edge.child !== parent &&
              remaining.has(edge.child) &&
              !(edge.child === "customers" && edge.parent === "media"),
          ),
      );
      if (!next.length)
        throw Error(
          "Unexpected demo-data dependency cycle. Refresh rolled back.",
        );
      for (const table of next) {
        ordered.push(table);
        remaining.delete(table);
      }
    }
    for (const table of ordered)
      await c.query(`DELETE FROM ${table} WHERE tenant_id=$1`, [tenant]);
    await c.query(
      "UPDATE tenants SET name=$2,slug=$3,currency='EUR',timezone='Europe/Paris',contact_email=$4,phone=$5,address=$6,tax_basis_points=2000,booking_min_hours=0,booking_max_days=120,cancel_hours=24,brand_color='#234c40',payment_methods=ARRAY['cash','card','bank_transfer'],plan='enterprise',max_locations=GREATEST(max_locations,2),updated_at=now() WHERE id=$1",
      [
        tenant,
        plan.salon.name,
        plan.salon.slug,
        plan.salon.email,
        plan.salon.phone,
        plan.salon.address,
      ],
    );
    await c.query("SET LOCAL TIME ZONE 'Europe/Paris'");
    await c.query(
      "UPDATE tenant_features SET enabled=true WHERE tenant_id=$1 AND feature_key IN ('customers','employees','services','appointments','pos','analytics','forms')",
      [tenant],
    );
    await c.query(
      "UPDATE users SET name='Juliette Moreau' WHERE email=$1 AND email LIKE 'salon.qa.%@example.test' AND platform_role IS NULL",
      [fixture.email],
    );
    const oldBranches = (
      await c.query(
        "SELECT id FROM branches WHERE tenant_id=$1 ORDER BY name",
        [tenant],
      )
    ).rows;
    const branchIds: string[] = [];
    for (let i = 0; i < plan.locations.length; i++) {
      const location = plan.locations[i],
        id = oldBranches[i]?.id || randomUUID(),
        key = `${tenant}/demo/${run}/locations/${id}.jpg`;
      branchIds.push(id);
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: images.get(location.photo),
          ContentType: "image/jpeg",
        }),
      );
      uploaded.push(key);
      await c.query(
        "INSERT INTO branches(id,tenant_id,name,address,active,image_key,image_version) VALUES($1,$2,$3,$4,true,$5,$6) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,active=true,image_key=EXCLUDED.image_key,image_version=EXCLUDED.image_version",
        [id, tenant, location.name, location.address, key, randomUUID()],
      );
    }
    for (let i = 2; i < oldBranches.length; i++)
      await c.query(
        "UPDATE branches SET active=false,name=$3 WHERE tenant_id=$1 AND id=$2",
        [tenant, oldBranches[i].id, "Archive · Studio " + (i + 1)],
      );
    const employeeIds: string[] = [],
      customerIds: string[] = [],
      serviceIds: string[] = [];
    const localTime = async (date: string, time: string) =>
      (
        await c.query(
          "SELECT ($1::date+$2::time) AT TIME ZONE 'Europe/Paris' value",
          [date, time],
        )
      ).rows[0].value;
    for (const [i, employee] of plan.employees.entries()) {
      const id = randomUUID();
      employeeIds.push(id);
      await c.query(
        "INSERT INTO employees(id,tenant_id,branch_id,name,title,email,phone,base_salary_minor,commission_basis_points,image_version,payroll_frequency,payroll_start_on,payroll_enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,date_trunc('month',now())::date,false)",
        [
          id,
          tenant,
          branchIds[employee.branch],
          employee.name,
          employee.title,
          "team." + (i + 1) + "@maison-elan.example",
          "+33 6 00 00 10 " + String(i + 10),
          employee.salary,
          employee.commission,
          randomUUID(),
          employee.frequency,
        ],
      );
      await c.query(
        "INSERT INTO employee_images(tenant_id,employee_id,content_type,data) VALUES($1,$2,'image/jpeg',$3)",
        [tenant, id, images.get(employee.photo)],
      );
      for (let weekday = 0; weekday < 7; weekday++)
        await c.query(
          "INSERT INTO employee_schedules(tenant_id,employee_id,weekday,opens_at,closes_at) VALUES($1,$2,$3,'09:00','19:00')",
          [tenant, id, weekday],
        );
    }
    for (const [i, customer] of plan.customers.entries()) {
      const id = randomUUID();
      customerIds.push(id);
      const email = "client." + (i + 1) + "@maison-elan.example";
      await c.query(
        "INSERT INTO customers(id,tenant_id,name,email,phone,notes,tags,preferred_channel) VALUES($1,$2,$3,$4,$5,$6,$7,'email')",
        [
          id,
          tenant,
          customer.name,
          email,
          "+33 6 00 00 20 " + String(i + 10),
          customer.note,
          ["Demo customer", i % 3 === 0 ? "Regular" : "New client"],
        ],
      );
      if (customer.photo) {
        const media = randomUUID(),
          key = `${tenant}/demo/${run}/customers/${id}.jpg`,
          bytes = images.get(customer.photo)!;
        await client.send(
          new PutObjectCommand({
            Bucket,
            Key: key,
            Body: bytes,
            ContentType: "image/jpeg",
          }),
        );
        uploaded.push(key);
        await c.query(
          "INSERT INTO media(id,tenant_id,customer_id,object_key,content_type,size_bytes,verified,purpose) VALUES($1,$2,$3,$4,'image/jpeg',$5,true,'customer_photo')",
          [media, tenant, id, key, bytes.length],
        );
        await c.query(
          "UPDATE customers SET photo_media_id=$3 WHERE tenant_id=$1 AND id=$2",
          [tenant, id, media],
        );
      }
    }
    for (const service of plan.services) {
      const id = randomUUID();
      serviceIds.push(id);
      await c.query(
        "INSERT INTO services(id,tenant_id,name,price_minor,duration_minutes,icon_key,image_version) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          tenant,
          service.name,
          service.price,
          service.minutes,
          service.icon,
          service.photo ? randomUUID() : null,
        ],
      );
      if (service.photo)
        await c.query(
          "INSERT INTO service_images(tenant_id,service_id,content_type,data) VALUES($1,$2,'image/jpeg',$3)",
          [tenant, id, images.get(service.photo)],
        );
    }
    for (const leave of plan.leaves)
      await c.query(
        "INSERT INTO employee_leaves(tenant_id,employee_id,starts_at,ends_at,paid,reason) VALUES($1,$2,$3,$4,$5,$6)",
        [
          tenant,
          employeeIds[leave.employee],
          await localTime(leave.date, leave.from),
          await localTime(leave.date, leave.until),
          leave.paid,
          leave.reason,
        ],
      );
    async function invoice(
      customer: string,
      employee: number,
      service: number,
      when: Date,
      appointment: string | null,
      discount = 0,
      tip = 0,
    ) {
      const subtotal = plan.services[service].price,
        tax = Math.round((subtotal - discount) * 0.2),
        total = subtotal - discount + tax + tip;
      const order = (
        await c.query(
          "INSERT INTO orders(tenant_id,branch_id,customer_id,appointment_id,employee_id,subtotal_minor,discount_minor,tax_minor,tip_minor,total_minor,status,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'paid',$11,$12) RETURNING id",
          [
            tenant,
            branchIds[plan.employees[employee].branch],
            customer,
            appointment,
            employeeIds[employee],
            subtotal,
            discount,
            tax,
            tip,
            total,
            "demo:" + randomUUID(),
            when,
          ],
        )
      ).rows[0].id;
      await c.query(
        "INSERT INTO order_items(tenant_id,order_id,service_id,name,quantity,price_minor) VALUES($1,$2,$3,$4,1,$5)",
        [
          tenant,
          order,
          serviceIds[service],
          plan.services[service].name,
          subtotal,
        ],
      );
      await c.query(
        "INSERT INTO payments(tenant_id,order_id,amount_minor,method,idempotency_key,created_at) VALUES($1,$2,$3,$4,$5,$6)",
        [
          tenant,
          order,
          total,
          employee % 2 ? "card" : "cash",
          "demo:" + randomUUID(),
          when,
        ],
      );
      return order;
    }
    for (const item of plan.appointments) {
      const sv = plan.services[item.service],
        start = await localTime(
          item.date,
          String(item.hour).padStart(2, "0") + ":00",
        ),
        end = new Date(start.getTime() + sv.minutes * 60000),
        id = randomUUID();
      await c.query(
        "INSERT INTO appointments(id,tenant_id,branch_id,customer_id,employee_id,starts_at,ends_at,status,notes,paid_in_advance,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          id,
          tenant,
          branchIds[plan.employees[item.employee].branch],
          customerIds[item.customer],
          employeeIds[item.employee],
          start,
          end,
          item.status,
          "Demo appointment · " + plan.customers[item.customer].note,
          item.advance,
          new Date(
            Math.min(start.getTime() - 2 * 86400000, Date.now() - 2 * 3600000),
          ),
        ],
      );
      await c.query(
        "INSERT INTO appointment_services(tenant_id,appointment_id,service_id,price_minor,duration_minutes) VALUES($1,$2,$3,$4,$5)",
        [tenant, id, serviceIds[item.service], sv.price, sv.minutes],
      );
      if (item.status === "completed" || item.advance)
        await invoice(
          customerIds[item.customer],
          item.employee,
          item.service,
          item.advance
            ? new Date(
                Math.min(start.getTime() - 86400000, Date.now() - 3600000),
              )
            : end,
          id,
        );
      if (item.status === "completed")
        await c.query(
          "INSERT INTO commissions(tenant_id,employee_id,appointment_id,amount_minor,created_at) VALUES($1,$2,$3,$4,$5)",
          [
            tenant,
            employeeIds[item.employee],
            id,
            Math.round(
              (sv.price * plan.employees[item.employee].commission) / 10000,
            ),
            end,
          ],
        );
    }
    for (const item of plan.quickVisits) {
      let customer = customerIds[item.customer];
      if (item.walkin) {
        customer = randomUUID();
        await c.query(
          "INSERT INTO customers(id,tenant_id,name,notes,is_walk_in) VALUES($1,$2,'Walk-in guest','Fictional demo walk-in',true)",
          [customer, tenant],
        );
      }
      let when = await localTime(
        item.date,
        String(item.hour).padStart(2, "0") + ":30",
      );
      if (item.date === plan.today && when > new Date())
        when = new Date(Date.now() - 5 * 60000);
      const order = await invoice(
          customer,
          item.employee,
          item.service,
          when,
          null,
          item.discount,
          item.tip,
        ),
        id = randomUUID();
      await c.query(
        "INSERT INTO quick_work_visits(id,tenant_id,branch_id,customer_id,employee_id,order_id,customer_type,payment_method,request_key,request_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'synthetic-demo',$10)",
        [
          id,
          tenant,
          branchIds[plan.employees[item.employee].branch],
          customer,
          employeeIds[item.employee],
          order,
          item.walkin ? "walkin" : "returning",
          item.employee % 2 ? "card" : "cash",
          randomUUID(),
          when,
        ],
      );
      await c.query(
        "INSERT INTO quick_work_services(tenant_id,visit_id,service_id,name,price_minor) VALUES($1,$2,$3,$4,$5)",
        [
          tenant,
          id,
          serviceIds[item.service],
          plan.services[item.service].name,
          plan.services[item.service].price,
        ],
      );
      await c.query(
        "INSERT INTO commissions(tenant_id,employee_id,quick_visit_id,amount_minor,created_at) VALUES($1,$2,$3,$4,$5)",
        [
          tenant,
          employeeIds[item.employee],
          id,
          Math.round(
            ((plan.services[item.service].price - item.discount) *
              plan.employees[item.employee].commission) /
              10000,
          ),
          when,
        ],
      );
    }
    const fields = [
      {
        key: "finish",
        label: "Your preferred finish",
        type: "select",
        required: true,
        options: ["Soft & natural", "Smooth & polished", "Textured & relaxed"],
      },
      {
        key: "preferences",
        label: "Anything you would like us to know?",
        type: "textarea",
        required: false,
      },
      {
        key: "consent",
        label: "I agree to this consultation",
        type: "consent",
        required: true,
      },
    ];
    for (let f = 0; f < 2; f++) {
      const id = randomUUID();
      await c.query(
        "INSERT INTO forms(id,tenant_id,name,description,fields,active) VALUES($1,$2,$3,$4,$5::jsonb,true)",
        [
          id,
          tenant,
          f ? "Colour consultation" : "New client welcome",
          "Tell us your preferences so we can personalise your visit.",
          JSON.stringify(fields),
        ],
      );
      for (let i = 0; i < 3; i++) {
        const person = i + f * 3;
        await c.query(
          "INSERT INTO form_submissions(tenant_id,form_id,customer_id,answers,fields_snapshot,respondent_name,respondent_email,device,reviewed,created_at) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7,$8::jsonb,$9,now()-($10::int*interval '1 day'))",
          [
            tenant,
            id,
            customerIds[person],
            JSON.stringify({
              finish: fields[0].options![i],
              preferences: plan.customers[person].note,
              consent: true,
            }),
            JSON.stringify(fields),
            plan.customers[person].name,
            "client." + (person + 1) + "@maison-elan.example",
            JSON.stringify({
              browser: i % 2 ? "Safari" : "Chrome",
              os: i % 2 ? "iOS" : "macOS",
              device_type: i % 2 ? "Mobile" : "Desktop",
              source: "Synthetic demo device",
            }),
            i === 0,
            i + 1,
          ],
        );
      }
    }
    const previous = (
      await c.query(
        "SELECT (date_trunc('month',now())-interval '1 month')::date::text start,(date_trunc('month',now())-interval '1 day')::date::text end",
      )
    ).rows[0];
    for (const [i, employee] of plan.employees.entries()) {
      const e = (
          await c.query(
            "SELECT * FROM employees WHERE tenant_id=$1 AND id=$2",
            [tenant, employeeIds[i]],
          )
        ).rows[0],
        calc = await calculatePayroll(
          c,
          tenant,
          e,
          previous.start,
          previous.end,
        );
      await c.query(
        "INSERT INTO payroll_records(tenant_id,employee_id,period_start,period_end,base_minor,commission_minor,unpaid_leave_minor,bonus_minor,deduction_minor,bonus_reason,deduction_reason,status,paid_at,automatic,calculation,calculated_at) VALUES($1,$2,$3,$4,$5,$6,$7,5000,0,'Team performance bonus','','paid',$8,true,$9::jsonb,$8)",
        [
          tenant,
          employeeIds[i],
          previous.start,
          previous.end,
          calc.base_minor,
          calc.commission_minor,
          calc.unpaid_leave_minor,
          await localTime(previous.end, "18:00"),
          JSON.stringify(calc.calculation),
        ],
      );
    }
    await c.query(
      "UPDATE employees SET payroll_enabled=true WHERE tenant_id=$1",
      [tenant],
    );
    await c.query(
      "INSERT INTO audit_logs(tenant_id,action,metadata) VALUES($1,'demo.europe.refreshed',$2::jsonb)",
      [tenant, JSON.stringify({ run, summary, syntheticDataOnly: true })],
    );
  });
  committed = true;
  await generatePayroll(tenant);
  await writeFile(
    new URL(".qa/qa-access.json", root),
    JSON.stringify(
      {
        ...fixture,
        salonName: plan.salon.name,
        slug: plan.salon.slug,
        syntheticDataOnly: true,
        europeDemoRun: run,
      },
      null,
      2,
    ),
  );
  await writeFile(
    new URL(".qa/europe-demo-photo-credits.json", root),
    JSON.stringify(
      {
        notice:
          "Stock photos illustrate fictional demo people and premises; they are not identities or endorsements.",
        license: "https://unsplash.com/license",
        photos: demoPhotos,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        applied: true,
        ...summary,
        backup: fileURLToPath(
          new URL("backups/europe-demo-before-" + run + ".json", root),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  if (!committed)
    for (const key of uploaded)
      await client
        .send(new DeleteObjectCommand({ Bucket, Key: key }))
        .catch(() => {});
  client.destroy();
  await pool.end();
}
