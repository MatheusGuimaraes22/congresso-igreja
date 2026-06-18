var CALENDAR_ID = "primary";
var ADMIN_EMAIL = "eventosiccruz@gmail.com";

function doPost(e) {
  try {
    var payloadText = "{}";

    if (e && e.postData && e.postData.contents) {
      payloadText = e.postData.contents;
    }

    var payload = JSON.parse(payloadText);

    if (payload.eventConfig) {
      return handleEventConfig(payload);
    }

    return handleRegistration(payload);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function doGet() {
  return jsonResponse({
    ok: true,
    message: "Apps Script Eventos ICC ativo."
  });
}

function handleRegistration(payload) {
  var registration = payload.registration || payload || {};
  var userEmail = String(registration.email || "").trim().toLowerCase();

  if (!userEmail || !registration.eventName) {
    return jsonResponse({
      ok: false,
      error: "Inscricao sem e-mail ou evento."
    });
  }

  registration.email = userEmail;

  var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  var start = buildDate(registration.eventDate, registration.eventStartsAt, 19);
  var end = buildDate(registration.eventDate, registration.eventEndsAt, 21);
  var title = registration.eventName + " - " + (registration.fullName || "Inscrito");

  var event = calendar.createEvent(title, start, end, {
    description: buildRegistrationMessage(registration),
    location: registration.eventAddress || "",
    guests: userEmail,
    sendInvites: true
  });

  MailApp.sendEmail({
    to: userEmail,
    bcc: ADMIN_EMAIL,
    subject: "Inscricao recebida - " + registration.eventName,
    body: buildUserEmail(registration),
    name: "Eventos ICC",
    attachments: [buildIcsAttachment(registration, start, end)]
  });

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: "Nova inscricao - " + registration.eventName,
    body: buildAdminRegistrationEmail(registration),
    name: "Eventos ICC"
  });

  var whatsapp = sendWhatsAppConfirmation(registration);

  return jsonResponse({
    ok: true,
    type: "registration",
    eventId: event.getId(),
    userEmail: userEmail,
    whatsapp: whatsapp
  });
}

function handleEventConfig(payload) {
  var eventConfig = payload.eventConfig || {};
  var action = payload.action === "updated" ? "atualizado" : "criado";

  if (!eventConfig.name) {
    return jsonResponse({
      ok: false,
      error: "Evento sem nome."
    });
  }

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: "Evento " + action + " - " + eventConfig.name,
    body: buildAdminEventEmail(eventConfig, action),
    name: "Eventos ICC"
  });

  return jsonResponse({
    ok: true,
    type: "event",
    action: action
  });
}

function buildDate(dateValue, timeValue, fallbackHour) {
  var timeZone = Session.getScriptTimeZone();
  var date = dateValue || Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");
  var text = String(timeValue || "");
  var match = text.match(/(\d{1,2})(?::|h)?(\d{2})?/);
  var hour = match ? Number(match[1]) : fallbackHour;
  var minute = match && match[2] ? Number(match[2]) : 0;

  return new Date(
    date +
      "T" +
      String(hour).padStart(2, "0") +
      ":" +
      String(minute).padStart(2, "0") +
      ":00"
  );
}

function buildRegistrationMessage(registration) {
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
    "Horario: " +
      (registration.eventStartsAt || "A confirmar") +
      " ate " +
      (registration.eventEndsAt || "A confirmar"),
    "Local: " + (registration.eventAddress || "A confirmar"),
    "Maps: " + (registration.eventMapsUrl || ""),
    "",
    "Codigo de inscricao: " + (registration.id || ""),
    "Status de pagamento: " + (registration.paymentStatus || ""),
    "Referencia de pagamento: " + (registration.paymentReference || ""),
    "QR Code/validacao: " + (registration.validationLink || ""),
    "",
    "O convite do evento tambem esta anexado a este e-mail em formato .ics.",
    "Caso o convite automatico do Google Agenda nao apareca, abra o anexo para adicionar o evento.",
    "",
    "Guarde o QR Code para apresentar a organizacao."
  ].join("\n");
}

function buildAdminRegistrationEmail(registration) {
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

function sendWhatsAppConfirmation(registration) {
  var phone = normalizeBrazilPhone(registration.phone || "");
  if (!phone) {
    return {
      ok: false,
      skipped: true,
      reason: "Telefone nao informado."
    };
  }

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("WHATSAPP_TOKEN");
  var phoneNumberId = props.getProperty("WHATSAPP_PHONE_NUMBER_ID");
  var templateName = props.getProperty("WHATSAPP_TEMPLATE_NAME") || "";
  var languageCode = props.getProperty("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR";

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      skipped: true,
      reason: "Credenciais do WhatsApp nao configuradas."
    };
  }

  var payload = templateName
    ? buildWhatsAppTemplatePayload(phone, templateName, languageCode, registration)
    : buildWhatsAppTextPayload(phone, registration);

  try {
    var response = UrlFetchApp.fetch("https://graph.facebook.com/v20.0/" + phoneNumberId + "/messages", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var status = response.getResponseCode();
    var body = response.getContentText();
    var ok = status >= 200 && status < 300;

    if (!ok) {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: "Falha no WhatsApp - " + (registration.eventName || "Evento ICC"),
        body: "Nao foi possivel enviar WhatsApp para " + phone + ".\n\nStatus: " + status + "\nResposta: " + body,
        name: "Eventos ICC"
      });
    }

    return {
      ok: ok,
      status: status,
      response: body
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error && error.message ? error.message : error)
    };
  }
}

function buildWhatsAppTextPayload(phone, registration) {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "text",
    text: {
      preview_url: true,
      body: buildWhatsAppText(registration)
    }
  };
}

function buildWhatsAppTemplatePayload(phone, templateName, languageCode, registration) {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
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
}

function buildWhatsAppText(registration) {
  return [
    "Ola, " + (registration.fullName || "inscrito") + ".",
    "Sua inscricao em " + (registration.eventName || "Evento ICC") + " foi recebida.",
    "Codigo: " + (registration.id || ""),
    "Status de pagamento: " + (registration.paymentStatus || ""),
    "Validacao/QR Code: " + (registration.validationLink || ""),
    "",
    "Guarde este link para apresentar a organizacao."
  ].join("\n");
}

function normalizeBrazilPhone(value) {
  var digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.length === 12 || digits.length === 13) return digits;
  return "";
}

function buildIcsAttachment(registration, start, end) {
  var uid = (registration.id || Utilities.getUuid()) + "@eventosicc.com";
  var content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eventos ICC//Inscricoes//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    "UID:" + escapeIcs(uid),
    "DTSTAMP:" + formatIcsDate(new Date()),
    "DTSTART:" + formatIcsDate(start),
    "DTEND:" + formatIcsDate(end),
    "SUMMARY:" + escapeIcs(registration.eventName || "Evento ICC"),
    "DESCRIPTION:" + escapeIcs(buildRegistrationMessage(registration)),
    "LOCATION:" + escapeIcs(registration.eventAddress || ""),
    "ORGANIZER;CN=Eventos ICC:MAILTO:" + ADMIN_EMAIL,
    "ATTENDEE;CN=" + escapeIcs(registration.fullName || "Inscrito") + ";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:" + registration.email,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  return Utilities.newBlob(content, "text/calendar", "convite-" + (registration.id || "evento") + ".ics");
}

function formatIcsDate(date) {
  return Utilities.formatDate(date, "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function escapeIcs(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildAdminEventEmail(eventConfig, action) {
  return [
    "Evento " + action + " pela administracao.",
    "",
    "Nome: " + (eventConfig.name || ""),
    "Tipo: " + (eventConfig.paid ? "Pago" : "Gratuito"),
    "Vagas: " + (eventConfig.capacity || "450"),
    "Data: " + (eventConfig.date || "A confirmar"),
    "Inicio: " + (eventConfig.startsAt || "A confirmar"),
    "Termino: " + (eventConfig.endsAt || "A confirmar"),
    "Publico: " + (eventConfig.audience || ""),
    "Endereco: " + (eventConfig.address || ""),
    "Maps: " + (eventConfig.mapsUrl || ""),
    "",
    "Descricao:",
    eventConfig.description || ""
  ].join("\n");
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}
