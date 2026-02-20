import { createServiceClient } from './client.ts';
import { getRuntimeEnv } from './env.ts';

interface SendEmailArgs {
  userId?: string;
  to: string;
  subject: string;
  html: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export const sendTransactionalEmail = async ({
  userId,
  to,
  subject,
  html,
  eventType,
  payload = {}
}: SendEmailArgs) => {
  const env = getRuntimeEnv();
  const service = createServiceClient();

  let status = 'skipped';
  let providerMessageId: string | null = null;
  let providerPayload: Record<string, unknown> = payload;

  if (env.resendApiKey && env.resendFromEmail) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to: [to],
        subject,
        html
      })
    });
    const body = await response.json().catch(() => ({}));
    status = response.ok ? 'sent' : 'failed';
    providerMessageId = (body?.id as string | undefined) ?? null;
    providerPayload = { ...payload, provider_response: body };
  }

  await service.from('notification_events').insert({
    user_id: userId ?? null,
    event_type: eventType,
    channel: 'email',
    provider: 'resend',
    provider_message_id: providerMessageId,
    status,
    payload: providerPayload
  });
};

