import { api } from "./api.service.js";

export const businessDayService = {
  async getSummary(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return await api.get(`/api/v1/business-day/summary${query}`);
  },

  async closeBusinessDay(notes) {
    return await api.post("/api/v1/business-day/close", { notes });
  },
};
