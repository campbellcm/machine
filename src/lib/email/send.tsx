import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { productName } from "@/lib/config";
export async function sendInvitation(
  email: string,
  company: string,
  url: string,
  id: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return false;
  try {
    const html = await render(
      <html>
        <body
          style={{
            fontFamily: "Arial,sans-serif",
            padding: 32,
            color: "#1d1d1f",
          }}
        >
          <h1>
            Join {company} on {productName}
          </h1>
          <p>
            You have been invited to your company’s private workspace.
            Participation is optional, and nothing is posted without your
            approval.
          </p>
          <p>
            <a href={url}>Accept your invitation</a>
          </p>
          <p>
            This link expires in seven days. Sign in using this email address
            before accepting.
          </p>
        </body>
      </html>,
    );
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
      {
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: `Your invitation to ${company}`,
        html,
      },
      { idempotencyKey: "invite/" + id },
    );
    return !error;
  } catch {
    return false;
  }
}
