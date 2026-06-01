import nodemailer from "nodemailer";

type EmailProvider = "smtp" | "resend";

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  image: string;
}

interface OrderEmailData {
  orderIds: number[];
  buyerName: string;
  buyerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shippingMethod: string;
  shippingCost: number;
  total: number;
  paymentMethod?: "cash_on_delivery" | "bank_transfer" | "card";
}

interface OrderReadyForCollectionEmailData {
  orderId: number;
  buyerName: string;
  buyerEmail: string;
  paymentMethod?: "cash_on_delivery" | "bank_transfer" | "card";
  productName?: string;
  collectionPoint?: string;
  trackUrl?: string;
}

export function formatPaymentMethodLabel(method?: "cash_on_delivery" | "bank_transfer" | "card"): string {
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "card") return "Card Payment";
  return "Cash on Delivery";
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS environment variables.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

async function sendViaResend(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Email] Resend failed (${response.status}): ${text}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Email] Resend transport error:", error);
    return false;
  }
}

async function sendEmailWithFallback(payload: {
  to: string;
  subject: string;
  html: string;
  context: "order confirmation" | "ready-for-collection";
}): Promise<{ ok: boolean; provider: EmailProvider | "none" }> {
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || "LESonline";
  const fromEmail = process.env.SMTP_USER;

  if (transporter && fromEmail) {
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      return { ok: true, provider: "smtp" };
    } catch (err) {
      console.error(`[Email] SMTP failed for ${payload.context}:`, err);
      if (!isResendConfigured()) {
        return { ok: false, provider: "none" };
      }
      const resendOk = await sendViaResend(payload);
      return { ok: resendOk, provider: resendOk ? "resend" : "none" };
    }
  }

  if (isResendConfigured()) {
    const resendOk = await sendViaResend(payload);
    return { ok: resendOk, provider: resendOk ? "resend" : "none" };
  }

  return { ok: false, provider: "none" };
}

export function getEmailDeliveryStatus() {
  return {
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
    resendConfigured: isResendConfigured(),
    smtpHost: process.env.SMTP_HOST || null,
    smtpUser: process.env.SMTP_USER || null,
    resendFrom: process.env.RESEND_FROM_EMAIL || null,
    fallbackOrder: ["smtp", "resend"],
  };
}

function buildOrderEmailHtml(data: OrderEmailData): string {
  const orderNumbers = data.orderIds.map(id => `#${id}`).join(", ");
  const paymentLabel = formatPaymentMethodLabel(data.paymentMethod);

  const itemRows = data.items.map(item => `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="80" style="vertical-align: top;">
              <img src="${item.image}" alt="${item.productName}" width="70" height="70" style="border-radius: 8px; object-fit: cover; border: 1px solid #e5e7eb;" />
            </td>
            <td style="vertical-align: top; padding-left: 12px;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a2e;">${item.productName} &times; ${item.quantity}</p>
            </td>
            <td width="120" style="vertical-align: top; text-align: right;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a2e;">M${(item.unitPrice * item.quantity).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a1a2e; padding: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">LES<span style="color: #c45e72;">online</span></h1>
              <p style="margin: 4px 0 0; font-size: 10px; color: #a0a0b0; letter-spacing: 2px; text-transform: uppercase;">APPLIANCES &amp; MORE</p>
            </td>
          </tr>

          <!-- Order Title -->
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; color: #1a1a2e;">Order ${orderNumbers}</h2>
              <p style="margin: 12px 0 0; font-size: 15px; color: #4b5563;">Thank you for your purchase!</p>
              <p style="margin: 6px 0 0; font-size: 14px; color: #6b7280;">We're getting your order ready to be shipped. We will notify you when it has been sent.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
            </td>
          </tr>

          <!-- Order Summary Title -->
          <tr>
            <td style="padding: 8px 32px 0;">
              <h3 style="margin: 0; font-size: 16px; color: #1a1a2e; font-weight: 700;">Order summary</h3>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="padding: 8px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 16px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Subtotal</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; text-align: right;">M${data.subtotal.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Shipping</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; text-align: right;">M${data.shippingCost.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Taxes</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; text-align: right;">M0.00</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 0;"><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;" /></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 16px; font-weight: 700; color: #1a1a2e;">Total</td>
                  <td style="padding: 8px 0; font-size: 16px; font-weight: 700; color: #1a1a2e; text-align: right;">M${data.total.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LSL</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 16px 32px 0;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Customer Info -->
          <tr>
            <td style="padding: 20px 32px 0;">
              <h3 style="margin: 0 0 12px; font-size: 16px; color: #1a1a2e; font-weight: 700;">Customer information</h3>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="50%" style="vertical-align: top; padding-right: 16px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280;">Contact</p>
                    <p style="margin: 0; font-size: 14px; color: #1a1a2e;">${data.buyerName}</p>
                    <p style="margin: 2px 0 0; font-size: 14px; color: #1a1a2e;">${data.buyerEmail}</p>
                  </td>
                  <td width="50%" style="vertical-align: top;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #6b7280;">Shipping method</p>
                    <p style="margin: 0; font-size: 14px; color: #1a1a2e;">${data.shippingMethod}</p>
                    <p style="margin: 8px 0 4px; font-size: 13px; font-weight: 600; color: #6b7280;">Payment method</p>
                    <p style="margin: 0; font-size: 14px; color: #1a1a2e;">${paymentLabel}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 32px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #9ca3af;">If you have any questions, reply to this email or contact us at</p>
              <p style="margin: 4px 0 0;"><a href="mailto:salesles05@gmail.com" style="font-size: 13px; color: #c45e72; text-decoration: none;">salesles05@gmail.com</a></p>
              <p style="margin: 16px 0 0; font-size: 11px; color: #d1d5db;">&copy; ${new Date().getFullYear()} LESonline. Maseru, Lesotho.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function buildOrderReadyForCollectionEmailHtml(data: OrderReadyForCollectionEmailData): string {
  const paymentLabel = formatPaymentMethodLabel(data.paymentMethod);
  const collectionPoint = data.collectionPoint || "LESonline Collection Point";
  const trackSection = data.trackUrl
    ? `<p style="margin: 16px 0 0;"><a href="${data.trackUrl}" style="display: inline-block; background: #1a1a2e; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;">Track Order</a></p>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color: #1a1a2e; padding: 28px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">LES<span style="color: #c45e72;">online</span></h1>
              <p style="margin: 8px 0 0; font-size: 12px; color: #d1d5db;">Your order is ready for collection</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 32px 8px;">
              <p style="margin: 0; font-size: 15px; color: #374151;">Hello ${data.buyerName},</p>
              <p style="margin: 12px 0 0; font-size: 15px; color: #111827; font-weight: 600;">Order #${data.orderId} is now ready.</p>
              <p style="margin: 8px 0 0; font-size: 14px; color: #4b5563;">${data.productName ? `Product: ${data.productName}<br/>` : ""}Collection point: ${collectionPoint}</p>
              <p style="margin: 14px 0 0; font-size: 14px; color: #4b5563;">Payment method on file: <strong>${paymentLabel}</strong></p>
              <p style="margin: 10px 0 0; font-size: 13px; color: #6b7280;">Bring your order number and the same email used at checkout when collecting.</p>
              ${trackSection}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Need help? Reply to this email or contact <a href="mailto:salesles05@gmail.com" style="color: #c45e72; text-decoration: none;">salesles05@gmail.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<boolean> {
  const orderNumbers = data.orderIds.map(id => `#${id}`).join(", ");
  const sendResult = await sendEmailWithFallback({
    to: data.buyerEmail,
    subject: `Order ${orderNumbers} confirmed`,
    html: buildOrderEmailHtml(data),
    context: "order confirmation",
  });

  if (!sendResult.ok) {
    console.error("[Email] Failed to send order confirmation with all providers");
    return false;
  }

  console.log(
    `[Email] Order confirmation sent to ${data.buyerEmail} for order(s) ${orderNumbers} via ${sendResult.provider}`,
  );
  return true;
}

export async function sendOrderReadyForCollectionEmail(data: OrderReadyForCollectionEmailData): Promise<boolean> {
  const sendResult = await sendEmailWithFallback({
    to: data.buyerEmail,
    subject: `Order #${data.orderId} is ready for collection`,
    html: buildOrderReadyForCollectionEmailHtml(data),
    context: "ready-for-collection",
  });

  if (!sendResult.ok) {
    console.error("[Email] Failed to send ready-for-collection email with all providers");
    return false;
  }

  console.log(
    `[Email] Ready-for-collection email sent to ${data.buyerEmail} for order #${data.orderId} via ${sendResult.provider}`,
  );
  return true;
}
