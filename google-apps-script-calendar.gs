const CALENDAR_ID = "primary";
const DEFAULT_START_HOUR = 19;
const DEFAULT_END_HOUR = 21;

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const registration = payload.registration || {};

    if (!registration.email || !registration.eventName) {
      return jsonResponse({ ok: false, error: "Inscrição sem e-mail ou evento." }, 400);
    }

    const calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    const start = buildDate(registration.eventDate, registration.eventStartsAt, DEFAULT_START_HOUR);
    const end = buildDate(registration.eventDate, registration.eventEndsAt, DEFAULT_END_HOUR);
    const title = `${registration.eventName} - ${registration.fullName || "Inscrito"}`;
    const description = [
      registration.eventDescription || "",
      "",
      `Inscrição: ${registration.id || ""}`,
      `Participante: ${registration.fullName || ""}`,
      `E-mail: ${registration.email || ""}`,
      `Telefone: ${registration.phone || ""}`,
      `Status de pagamento: ${registration.paymentStatus || ""}`,
      `Referência: ${registration.paymentReference || ""}`,
      `QR Code/validação: ${registration.validationLink || ""}`,
      `Maps: ${registration.eventMapsUrl || ""}`
    ].join("\n");

    const event = calendar.createEvent(title, start, end, {
      description,
      location: registration.eventAddress || "",
      guests: registration.email,
      sendInvites: true
    });

    return jsonResponse({
      ok: true,
      eventId: event.getId(),
      htmlLink: event.getHtmlLink()
    }, 200);
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message }, 500);
  }
}

function buildDate(dateValue, timeValue, fallbackHour) {
  const date = dateValue || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const match = String(timeValue || "").match(/(\d{1,2})(?::|h)?(\d{2})?/);
  const hour = match ? Number(match[1]) : fallbackHour;
  const minute = match && match[2] ? Number(match[2]) : 0;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
}

function jsonResponse(body, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify({ ...body, statusCode }))
    .setMimeType(ContentService.MimeType.JSON);
}
