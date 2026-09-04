const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(path, { token, body, headers, ...options } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Unable to connect to the server.");
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const detail = typeof data?.detail === "string" ? data.detail : "Request failed.";
    throw new ApiError(detail, response.status, data?.detail ?? null);
  }
  return data;
}

export async function apiBlobRequest(path, { token, signal } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Unable to connect to the server.");
  }
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;
    throw new ApiError(typeof data?.detail === "string" ? data.detail : "Request failed.", response.status);
  }
  if (!(response.headers.get("content-type") || "").includes("image/png")) throw new ApiError("Invalid QR image response.", 502);
  return response.blob();
}

export function login(email, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function registerAccount(payload) {
  return apiRequest("/api/auth/register", { method: "POST", body: payload });
}

export function getUsers(token, signal) {
  return apiRequest("/api/admin/users", { token, signal });
}

export function createUser(payload, token) {
  return apiRequest("/api/admin/users", { method: "POST", token, body: payload });
}

export function updateUser(userId, payload, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "PATCH", token, body: payload });
}

export function resetUserPassword(userId, newPassword, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, { method: "POST", token, body: { new_password: newPassword } });
}

export function getCurrentUser(token, signal) {
  return apiRequest("/api/auth/me", { token, signal });
}

export function updateMyProfile(payload, token) {
  return apiRequest("/api/auth/me", { method: "PATCH", token, body: payload });
}

export function changeMyPassword(payload, token) {
  return apiRequest("/api/auth/change-password", { method: "POST", token, body: payload });
}

export function getEvents(token, signal) {
  return apiRequest("/api/events", { token, signal });
}

export function getEvent(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}`, { token, signal });
}

export function createEvent(payload, token) {
  return apiRequest("/api/events", { method: "POST", token, body: payload });
}

export function updateEvent(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    token,
    body: payload,
  });
}

export function deleteEvent(eventId, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    token,
  });
}

export function getSpeakers(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/speakers`, {
    token,
    signal,
  });
}

export function getSpeaker(eventId, speakerId, token, signal) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/speakers/${encodeURIComponent(speakerId)}`,
    { token, signal },
  );
}

export function createSpeaker(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/speakers`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateSpeaker(eventId, speakerId, payload, token) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/speakers/${encodeURIComponent(speakerId)}`,
    { method: "PATCH", token, body: payload },
  );
}

export function deleteSpeaker(eventId, speakerId, token) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/speakers/${encodeURIComponent(speakerId)}`,
    { method: "DELETE", token },
  );
}

export function getSchedules(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/schedules`, { token, signal });
}

export function getSchedule(eventId, scheduleId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/schedules/${encodeURIComponent(scheduleId)}`, { token, signal });
}

export function createSchedule(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/schedules`, { method: "POST", token, body: payload });
}

export function updateSchedule(eventId, scheduleId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/schedules/${encodeURIComponent(scheduleId)}`, { method: "PATCH", token, body: payload });
}

export function deleteSchedule(eventId, scheduleId, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/schedules/${encodeURIComponent(scheduleId)}`, { method: "DELETE", token });
}

export function getEventStatistics(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/statistics`, {
    token,
    signal,
  });
}

export function getEventRegistrations(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/registrations`, {
    token,
    signal,
  });
}

export function getCheckInEvents(token, signal) {
  return apiRequest("/api/checkin/events", { token, signal });
}

export function checkInTicket(eventId, ticketCode, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/checkins`, { method: "POST", token, body: { ticket_code: ticketCode } });
}

export function generateFeedbackSummary(eventId, token, signal) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/ai/feedback-summary`,
    {
      method: "POST",
      token,
      signal,
    },
  );
}

export function getAnnouncements(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/announcements`, {
    token,
    signal,
  });
}

export function getAnnouncement(eventId, announcementId, token, signal) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/announcements/${encodeURIComponent(announcementId)}`,
    { token, signal },
  );
}

export function createAnnouncement(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/announcements`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function updateAnnouncement(eventId, announcementId, payload, token) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: "PATCH", token, body: payload },
  );
}

export function deleteAnnouncement(eventId, announcementId, token) {
  return apiRequest(
    `/api/events/${encodeURIComponent(eventId)}/announcements/${encodeURIComponent(announcementId)}`,
    { method: "DELETE", token },
  );
}

export function generateAnnouncementDraft(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/ai/announcement-draft`, {
    method: "POST",
    token,
    body: payload,
  });
}

export function askEventAI(eventId, question, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/ai/chat`, {
    method: "POST",
    token,
    body: { question },
    signal,
  });
}

export function getMyAnnouncements(token, signal) {
  return apiRequest("/api/announcements/me", { token, signal });
}

export function getAttendeeEvents(token, signal) {
  return apiRequest("/api/attendee/events", { token, signal });
}

export function getMyRegistrations(token, signal) {
  return apiRequest("/api/registrations/me", { token, signal });
}

export function registerForEvent(eventId, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/registrations`, { method: "POST", token });
}

export function cancelMyRegistration(eventId, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/registrations/me`, { method: "DELETE", token });
}

export function getMyTickets(token, signal) {
  return apiRequest("/api/tickets/me", { token, signal });
}

export function getMyTicket(ticketId, token, signal) {
  return apiRequest(`/api/tickets/me/${encodeURIComponent(ticketId)}`, { token, signal });
}

export function getMyTicketQr(ticketId, token, signal) {
  return apiBlobRequest(`/api/tickets/me/${encodeURIComponent(ticketId)}/qr`, { token, signal });
}

export function getMyEventFeedback(eventId, token, signal) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/feedbacks/me`, { token, signal });
}
export function createEventFeedback(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/feedbacks`, { method: "POST", token, body: payload });
}
export function updateMyEventFeedback(eventId, payload, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/feedbacks/me`, { method: "PATCH", token, body: payload });
}
export function deleteMyEventFeedback(eventId, token) {
  return apiRequest(`/api/events/${encodeURIComponent(eventId)}/feedbacks/me`, { method: "DELETE", token });
}

export function getMyAnnouncement(announcementId, token, signal) {
  return apiRequest(`/api/announcements/me/${encodeURIComponent(announcementId)}`, {
    token,
    signal,
  });
}

export function checkBackendHealth() {
  return apiRequest("/api/health");
}

export function checkDatabaseHealth() {
  return apiRequest("/api/health/database");
}
