import PDFDocument from "pdfkit";
export async function invoicePDF(data: any): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 46,
    info: {
      Title: `Etalier invoice ${data.number}`,
      Author: "Etalier",
      Subject: "Customer invoice and payment history",
    },
  });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const primary = "#234c40",
    muted = "#65736b",
    border = "#dedfd6",
    money = (value: number) =>
      data.order.currency +
      " " +
      new Intl.NumberFormat("en", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value) / 100);
  const date = (value: string) =>
    new Date(value).toLocaleDateString("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: data.order.timezone,
    });
  function text(
    value: string,
    x: number,
    y: number,
    width: number,
    size = 10,
    color = primary,
    align: "left" | "right" = "left",
  ) {
    doc
      .font("Helvetica")
      .fontSize(size)
      .fillColor(color)
      .text(String(value || ""), x, y, { width, align });
  }
  function star(x: number, y: number) {
    doc.save().lineWidth(2.5).lineCap("round").strokeColor(primary);
    for (const [dx, dy] of [
      [0, 11],
      [11, 0],
      [8, 8],
      [8, -8],
    ])
      doc
        .moveTo(x - dx, y - dy)
        .lineTo(x + dx, y + dy)
        .stroke();
    doc.restore();
  }
  function pageHeader() {
    star(58, 60);
    text("etalier", 78, 47, 220, 25);
    text("INVOICE", 365, 48, 184, 22, primary, "right");
    text(data.number, 330, 79, 219, 10, muted, "right");
  }
  pageHeader();
  let y = 116;
  text(data.order.salon_name, 46, y, 270, 14);
  text(
    `Issued ${date(data.order.created_at)}`,
    330,
    y,
    219,
    10,
    muted,
    "right",
  );
  y += 24;
  const address = data.order.branch_address || data.order.salon_address || "";
  text(
    [
      data.order.branch_name,
      address,
      data.order.salon_email,
      data.order.salon_phone,
    ]
      .filter(Boolean)
      .join("\n"),
    46,
    y,
    260,
    10,
    muted,
  );
  y = Math.max(
    y +
      doc.heightOfString(
        [
          data.order.branch_name,
          address,
          data.order.salon_email,
          data.order.salon_phone,
        ]
          .filter(Boolean)
          .join("\n"),
        { width: 260 },
      ) +
      25,
    185,
  );
  text("BILL TO", 46, y, 270, 9, muted);
  text("PAYMENT STATUS", 330, y, 219, 9, muted, "right");
  y += 18;
  text(data.order.customer_name, 46, y, 270, 13);
  text(data.summary.label, 330, y, 219, 13, primary, "right");
  y += 22;
  text(
    [data.order.customer_email, data.order.customer_phone]
      .filter(Boolean)
      .join("\n"),
    46,
    y,
    270,
    10,
    muted,
  );
  y += 32;
  if (data.order.employee_name) {
    text("Team member: " + data.order.employee_name, 46, y, 500, 10, muted);
    y += 20;
  }
  function tableHeader() {
    doc.rect(46, y, 503, 27).fill("#f6f3eb");
    text("DESCRIPTION", 55, y + 9, 285, 8, muted);
    text("QTY", 350, y + 9, 35, 8, muted, "right");
    text("UNIT PRICE", 395, y + 9, 65, 8, muted, "right");
    text("AMOUNT", 469, y + 9, 71, 8, muted, "right");
    y += 36;
  }
  tableHeader();
  for (const item of data.items) {
    const height = Math.max(
      30,
      doc.fontSize(10).heightOfString(item.name, { width: 275 }) + 16,
    );
    if (y + height > 690) {
      doc.addPage();
      y = 50;
      tableHeader();
    }
    text(item.name, 55, y, 275);
    text(String(item.quantity), 350, y, 35, 10, primary, "right");
    text(money(item.price_minor), 389, y, 78, 9, primary, "right");
    text(
      money(item.price_minor * item.quantity),
      469,
      y,
      71,
      9,
      primary,
      "right",
    );
    y += height;
    doc
      .strokeColor(border)
      .lineWidth(0.5)
      .moveTo(46, y - 7)
      .lineTo(549, y - 7)
      .stroke();
  }
  if (y > 545) {
    doc.addPage();
    y = 50;
  }
  y += 15;
  for (const [label, value] of [
    ["Subtotal", data.order.subtotal_minor],
    ["Discount", -Number(data.order.discount_minor)],
    ["Tax", data.order.tax_minor],
    ["Tip", data.order.tip_minor || 0],
    ["Invoice total", data.order.total_minor],
    ["Payments received", data.summary.paid_minor],
    ["Refunded", -data.summary.refunded_minor],
    ["Net paid", data.summary.net_paid_minor],
    ["Amount due", data.summary.balance_minor],
  ] as [string, number][]) {
    const strong = ["Invoice total", "Net paid", "Amount due"].includes(label);
    if (strong) doc.font("Helvetica-Bold");
    text(label, 297, y, 150, strong ? 11 : 10, primary);
    text(money(value), 444, y, 96, strong ? 11 : 10, primary, "right");
    y += strong ? 22 : 18;
  }
  if (data.payments?.length) {
    if (y + 70 > 735) {
      doc.addPage();
      y = 50;
    }
    text("Payment history", 46, y, 500, 11);
    y += 22;
    for (const payment of data.payments) {
      if (y + 40 > 735) {
        doc.addPage();
        y = 50;
      }
      const method = String(payment.method).replaceAll("_", " ");
      text(
        `${date(payment.created_at)} - ${method} - ${money(payment.amount_minor)}`,
        46,
        y,
        500,
        9,
        muted,
      );
      y = doc.y + 14;
    }
  }
  if (data.refunds.length) {
    if (y + 75 > 735) {
      doc.addPage();
      y = 50;
    }
    text("Refund history", 46, y, 500, 11);
    y += 22;
    for (const refund of data.refunds) {
      if (y + 45 > 735) {
        doc.addPage();
        y = 50;
      }
      text(
        `${date(refund.created_at)} - ${money(refund.amount_minor)} - ${refund.reason}`,
        46,
        y,
        500,
        9,
        muted,
      );
      y = doc.y + 14;
    }
  }
  if (y + 65 > 750) {
    doc.addPage();
    y = 50;
  }
  y += 16;
  text("Thank you for visiting " + data.order.salon_name + ".", 46, y, 503, 10);
  text("Invoice reference: " + data.order.id, 46, y + 22, 503, 8, muted);
  doc.end();
  return output;
}
