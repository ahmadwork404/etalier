import React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Link,
  render,
} from "react-email";
import { portalUrl, siteUrl } from "./public-urls.js";

export type EmailContent = {
  title: string;
  preview: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  details?: { label: string; value: string }[];
  table?: { heading: string; rows: { label: string; amount: string }[] };
  footer?: string;
};
export function EmailTemplate({
  title,
  preview,
  paragraphs,
  action,
  details,
  table,
  footer,
}: EmailContent) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f5f3eb",
          color: "#203d34",
          fontFamily: "Arial, Helvetica, sans-serif",
          margin: 0,
          padding: "32px 12px",
        }}
      >
        <Container
          style={{
            maxWidth: 580,
            backgroundColor: "#ffffff",
            borderRadius: 16,
            padding: "36px 28px",
          }}
        >
          <Link
            href={siteUrl()}
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#244d40",
              textDecoration: "none",
            }}
          >
            etalier<span style={{ color: "#b94d33" }}> ✳</span>
          </Link>
          <Heading
            as="h1"
            style={{ fontSize: 25, lineHeight: "32px", margin: "32px 0 20px" }}
          >
            {title}
          </Heading>
          {paragraphs.map((paragraph, index) => (
            <Text
              key={index}
              style={{
                fontSize: 15,
                lineHeight: "24px",
                color: "#394c45",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {paragraph}
            </Text>
          ))}
          {details?.map((item, index) => (
            <Text
              key={index}
              style={{
                fontSize: 14,
                lineHeight: "22px",
                margin: "12px 0",
                overflowWrap: "anywhere",
              }}
            >
              <strong>{item.label}</strong>
              <br />
              {item.value}
            </Text>
          ))}
          {table && (
            <table
              width="100%"
              cellPadding="0"
              cellSpacing="0"
              border={0}
              style={{ marginTop: 20, borderCollapse: "collapse" }}
            >
              <thead>
                <tr>
                  <th
                    align="left"
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #dedfd6",
                      fontSize: 13,
                      lineHeight: "20px",
                      color: "#203d34",
                    }}
                  >
                    {table.heading}
                  </th>
                  <th
                    align="right"
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #dedfd6",
                      fontSize: 13,
                      lineHeight: "20px",
                      color: "#203d34",
                    }}
                  >
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        padding: "10px 0",
                        fontSize: 14,
                        lineHeight: "22px",
                        color: "#394c45",
                        borderBottom: "1px solid #eff0e9",
                      }}
                    >
                      {row.label}
                    </td>
                    <td
                      align="right"
                      style={{
                        padding: "10px 0",
                        fontSize: 14,
                        lineHeight: "22px",
                        color: "#394c45",
                        borderBottom: "1px solid #eff0e9",
                      }}
                    >
                      {row.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {action && (
            <Button
              href={action.url}
              style={{
                backgroundColor: "#244d40",
                borderRadius: 8,
                color: "#ffffff",
                fontWeight: 600,
                fontSize: 14,
                padding: "14px 22px",
                margin: "16px 0",
                textDecoration: "none",
              }}
            >
              {action.label}
            </Button>
          )}
          <Hr style={{ borderColor: "#e7e8e0", marginTop: 28 }} />
          <Text style={{ fontSize: 12, lineHeight: "20px", color: "#65736b" }}>
            {footer ||
              "Sent by Etalier in connection with your account or enquiry."}
          </Text>
          <Link href={siteUrl()} style={{ fontSize: 12, color: "#244d40" }}>
            etalier.app
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
export async function renderEmail(content: EmailContent) {
  return {
    html: await render(<EmailTemplate {...content} />),
    text: [
      content.title,
      ...content.paragraphs,
      ...(content.details || []).map((item) => `${item.label}: ${item.value}`),
      ...(content.table?.rows || []).map(
        (item) => `${item.label}: ${item.amount}`,
      ),
      content.action ? `${content.action.label}: ${content.action.url}` : "",
      content.footer || "Sent by Etalier.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
export function invoiceEmail(data: any): EmailContent {
  const money = (value: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: data.order.currency,
    }).format(Number(value || 0) / 100);
  return {
    title: `Your invoice from ${data.order.salon_name}`,
    preview: `${data.number} · ${money(data.order.total_minor)}`,
    paragraphs: [
      `Hello ${data.order.customer_name || "there"},`,
      `Thank you for visiting ${data.order.salon_name}. Here is your invoice and payment summary.`,
    ],
    details: [
      { label: "Invoice", value: data.number },
      {
        label: "Date",
        value: new Date(data.order.created_at).toLocaleDateString("en-GB", {
          timeZone: data.order.timezone || "UTC",
        }),
      },
      { label: "Payment status", value: data.summary.label },
    ],
    table: {
      heading: "Services & charges",
      rows: [
        ...data.items.map((item: any) => ({
          label: `${item.name} × ${item.quantity}`,
          amount: money(item.price_minor * item.quantity),
        })),
        { label: "Subtotal", amount: money(data.order.subtotal_minor) },
        { label: "Discount", amount: money(-data.order.discount_minor) },
        { label: "Tax", amount: money(data.order.tax_minor) },
        { label: "Tip", amount: money(data.order.tip_minor) },
        { label: "Invoice total", amount: money(data.order.total_minor) },
        { label: "Payments received", amount: money(data.summary.paid_minor) },
        ...(data.summary.refunded_minor
          ? [{ label: "Refunded", amount: money(data.summary.refunded_minor) }]
          : []),
        { label: "Amount due", amount: money(data.summary.balance_minor) },
      ],
    },
    footer:
      "Please keep this email for your records. Questions about a visit or payment should be directed to your salon.",
  };
}
// All existing transactional send paths receive the same accessible branded layout.
export function contentForMessage(subject: string, text: string): EmailContent {
  const url = text.match(/https?:\/\/[^\s]+/g)?.find((value) => {
    try {
      return new URL(value).origin === new URL(portalUrl()).origin;
    } catch {
      return false;
    }
  });
  const reset = /reset.*password/i.test(subject),
    verify = /verify.*email/i.test(subject);
  if (reset)
    return {
      title: "Reset your password",
      preview: "Your password reset link expires in 30 minutes.",
      paragraphs: [
        "We received a request to reset your Etalier password.",
        "Use the button below to choose a new password. This link expires in 30 minutes and can be used once.",
        "If you did not request this, you can ignore this email. Your password will stay the same.",
      ],
      action: url ? { label: "Reset password", url } : undefined,
    };
  if (verify)
    return {
      title: "Confirm your email address",
      preview: "Confirm your email address to use your Etalier account.",
      paragraphs: [
        "Confirm this email address to finish setting up your Etalier account.",
        "This link expires in 24 hours and can be used once. If you did not create an account, you can ignore this email.",
      ],
      action: url ? { label: "Confirm email", url } : undefined,
    };
  return {
    title: subject.replace(/Atelier/g, "Etalier"),
    preview: subject.replace(/Atelier/g, "Etalier"),
    paragraphs: text.replace(/Atelier/g, "Etalier").split(/\n\n/),
    action: url
      ? {
          label: /form|complete/i.test(subject) ? "Open form" : "View details",
          url,
        }
      : undefined,
  };
}
