const CALENDAR_ID = "primary";
const ADMIN_EMAIL = "eventosiccruz@gmail.com";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const registration = payload.registration || {};

    if (!registration.email || !registration.eventName) {
      return jsonResponse({ ok: false, error: "Inscricao sem e-mail ou evento." });
    }

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const start = buildDate(registration.eventDate, registration.eventStartsAt, 19);
    const end = buildDate(registration.eventDate, registration.eventEndsAt, 21);
    const title = registration.eventName + " - " + (registration.fullName || "Inscrito");
    const description = buildMessage(registration);

    const event = calendar.createEvent(title, start, end, {
      description: description,
      location: registration.eventAddress || "",
      guests: registration.email,
      sendInvites: true
    });

    MailApp.sendEmail({
      to: registration.email,
      subject: "Inscricao recebida - " + registration.eventName,
      body: buildUserEmail(registration),
      name: "Eventos ICC"
    });

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: "Nova inscricao - " + registration.eventName,
      body: buildAdminEmail(registration),
      name: "Eventos ICC"
    });

    return jsonResponse({
      ok: true,
      eventId: event.getId(),
      eventLink: event.getHtmlLink()
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  }
}

function buildDate(dateValue, timeValue, fallbackHour) {
  const timeZone = Session.getScriptTimeZone();
  const date = dateValue || Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");
  const match = String(timeValue || "").match(/(\d{1,2})(?::|h)?(\d{2})?/);
  const hour = match ? Number(match[1]) : fallbackHour;
  const minute = match && match[2] ? Number(match[2]) : 0;
  return new Date(date + "T" + String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0") + ":00");
}

function buildMessage(registration) {
  return [
    registration.eventDescription || "",
    "",
    "Inscricao: " + (registration.id || ""),
    "Participante: " + (registration.fullName || ""),
    "E-mail: " + (registration.email || ""),
    "Telefone: " + (registration.phone || ""),
    "Status de pagamento: " + (registration.paymentStatus || ""),
    "Referencia: " + (registration.paymentReference || ""),
    "QR Code/validacao: " + (registration.validationLink || ""),
    "Maps: " + (registration.eventMapsUrl || "")
  ].join("\n");
}

function buildUserEmail(registration) {
  return [
    "Ola, " + (registration.fullName || "inscrito") + ".",
    "",
    "Sua inscricao em " + (registration.eventName || "Evento ICC") + " foi recebida.",
    "",
    "Data: " + (registration.eventDate || "A confirmar"),
    "Horario: " + (registration.eventStartsAt || "A confirmar") + " ate " + (registration.eventEndsAt || "A confirmar"),
    "Local: " + (registration.eventAddress || "A confirmar"),
    "Maps: " + (registration.eventMapsUrl || ""),
    "",
    "Codigo de inscricao: " + (registration.id || ""),
    "Status de pagamento: " + (registration.paymentStatus || ""),
    "Referencia de pagamento: " + (registration.paymentReference || ""),
    "QR Code/validacao: " + (registration.validationLink || ""),
    "",
    "Guarde o QR Code para apresentar a organizacao."
  ].join("\n");
}

function buildAdminEmail(registration) {
  return [
    "Nova inscricao recebida.",
    "",
    "Evento: " + (registration.eventName || ""),
    "Participante: " + (registration.fullName || ""),
    "E-mail: " + (registration.email || ""),
    "WhatsApp: " + (registration.phone || ""),
    "Codigo: " + (registration.id || ""),
    "Pagamento: " + (registration.paymentStatus || ""),
    "Referencia: " + (registration.paymentReference || ""),
    "Validacao: " + (registration.validationLink || "")
  ].join("\n");
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
