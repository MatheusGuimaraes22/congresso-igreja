const CALENDAR_ID = "primary";
const DEFAULT_START_HOUR = 19;
const DEFAULT_END_HOUR = 21;

const SCRIPT_PROPS = PropertiesService.getScriptProperties();

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const registration = payload.registration || {};

    if (!registration.email || !registration.eventName) {
      return jsonResponse({ ok: false, error: "Inscricao sem e-mail ou evento." }, 400);
    }

    const calendarResult = createCalendarInvite(registration);
    const emailResult = sendRegistrationEmail(registration);
    const adminEmailResult = sendAdminEmail(registration);
    const whatsappResult = sendWhatsAppConfirmation(registration);

    return jsonResponse({
      ok: true,
      calendar: calendarResult,
      email: emailResult,
      adminEmail: adminEmailResult,
      whatsapp: whatsappResult
    }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }
}

function createCalendarInvite(registration) {
  const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  const start = buildDate(registration.eventDate, registration.eventStartsAt, DEFAULT_START_HOUR);
  const end = buildDate(registration.eventDate, registration.eventEndsAt, DEFAULT_END_HOUR);
  end.setDate(end.getDate() + Math.max(0, Number(registration.eventDurationDays || 1) - 1));
  const title = `${registration.eventName} - ${registration.fullName || "Inscrito"}`;
  const description = [
    registration.eventDescription || "",
    "",
    `Inscricao: ${registration.id || ""}`,
    `Participante: ${registration.fullName || ""}`,
    `E-mail: ${registration.email || ""}`,
    `Telefone: ${registration.phone || ""}`,
    `Dias de participacao: ${getEventDaysText(registration)}`,
    `Status de pagamento: ${registration.paymentStatus || ""}`,
    `Referencia: ${registration.paymentReference || ""}`,
    `QR Code/validacao: ${registration.validationLink || ""}`,
    `Maps: ${registration.eventMapsUrl || ""}`
  ].join("\n");

  const event = calendar.createEvent(title, start, end, {
    description,
    location: registration.eventAddress || "",
    guests: registration.email,
    sendInvites: true
  });

  return {
    ok: true,
    eventId: event.getId()
  };
}

function sendRegistrationEmail(registration) {
  const subject = `Inscricao recebida - ${registration.eventName || "Evento ICC"}`;
  const body = buildUserMessage(registration);

  MailApp.sendEmail({
    to: registration.email,
    subject,
    body,
    name: "Eventos ICC"
  });

  return { ok: true, to: registration.email };
}

function sendAdminEmail(registration) {
  const adminEmail = SCRIPT_PROPS.getProperty("ADMIN_EMAIL") || "";
  if (!adminEmail) return { ok: false, skipped: true, reason: "ADMIN_EMAIL nao configurado." };

  const subject = `Nova inscricao - ${registration.eventName || "Evento ICC"} - ${registration.fullName || "Inscrito"}`;
  const body = [
    "Nova inscricao recebida.",
    "",
    `Evento: ${registration.eventName || ""}`,
    `Participante: ${registration.fullName || ""}`,
    `E-mail: ${registration.email || ""}`,
    `WhatsApp: ${registration.phone || ""}`,
    `Dias de participacao: ${getEventDaysText(registration)}`,
    `Codigo: ${registration.id || ""}`,
    `Pagamento: ${registration.paymentStatus || ""}`,
    `Referencia: ${registration.paymentReference || ""}`,
    `Validacao: ${registration.validationLink || ""}`,
    `Maps: ${registration.eventMapsUrl || ""}`
  ].join("\n");

  MailApp.sendEmail({
    to: adminEmail,
    subject,
    body,
    name: "Eventos ICC"
  });

  return { ok: true, to: adminEmail };
}

function sendWhatsAppConfirmation(registration) {
  const token = SCRIPT_PROPS.getProperty("WHATSAPP_TOKEN") || "";
  const phoneNumberId = SCRIPT_PROPS.getProperty("WHATSAPP_PHONE_NUMBER_ID") || "";
  const templateName = SCRIPT_PROPS.getProperty("WHATSAPP_TEMPLATE_NAME") || "confirmacao_inscricao";
  const templateLanguage = SCRIPT_PROPS.getProperty("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR";
  const graphVersion = SCRIPT_PROPS.getProperty("WHATSAPP_GRAPH_VERSION") || "v23.0";
  const to = normalizeBrazilPhone(registration.phone);

  if (!to) return { ok: false, skipped: true, reason: "Telefone do inscrito nao informado." };
  if (!token || !phoneNumberId) {
    return { ok: false, skipped: true, reason: "Credenciais do WhatsApp nao configuradas." };
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: registration.fullName || "inscrito" },
            { type: "text", text: registration.eventName || "Evento ICC" },
            { type: "text", text: registration.id || "" },
            { type: "text", text: registration.validationLink || "" }
          ]
        }
      ]
    }
  };

  const response = UrlFetchApp.fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${token}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    return { ok: false, status, response: safeJson(text) || text };
  }

  return { ok: true, status, response: safeJson(text) || text };
}

function buildUserMessage(registration) {
  return [
    `Ola, ${registration.fullName || "inscrito"}.`,
    "",
    `Sua inscricao em ${registration.eventName || "Evento ICC"} foi recebida.`,
    "",
    registration.eventDescription || "",
    `Data: ${registration.eventDate || "A confirmar"}`,
    `Dias de participacao: ${getEventDaysText(registration)}`,
    `Horario: ${registration.eventStartsAt || "A confirmar"} ate ${registration.eventEndsAt || "A confirmar"}`,
    `Local: ${registration.eventAddress || "A confirmar"}`,
    `Maps: ${registration.eventMapsUrl || ""}`,
    "",
    `Codigo de inscricao: ${registration.id || ""}`,
    `Status de pagamento: ${registration.paymentStatus || ""}`,
    `Referencia de pagamento: ${registration.paymentReference || ""}`,
    `QR Code/validacao: ${registration.validationLink || ""}`,
    "",
    "Guarde o QR Code para apresentar a organizacao."
  ].filter((line) => line !== "").join("\n");
}

function getEventDaysText(registration) {
  if (registration.eventDaysText) return registration.eventDaysText;
  if (Array.isArray(registration.eventDaysLabels) && registration.eventDaysLabels.length) {
    return registration.eventDaysLabels.join(", ");
  }
  if (Array.isArray(registration.eventDays) && registration.eventDays.length) {
    return registration.eventDays.join(", ");
  }
  return "Nao informado";
}

function normalizeBrazilPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function buildDate(dateValue, timeValue, fallbackHour) {
  const date = dateValue || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const match = String(timeValue || "").match(/(\d{1,2})(?::|h)?(\d{2})?/);
  const hour = match ? Number(match[1]) : fallbackHour;
  const minute = match && match[2] ? Number(match[2]) : 0;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function jsonResponse(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify({ ...body, statusCode }))
    .setMimeType(ContentService.MimeType.JSON);
}
