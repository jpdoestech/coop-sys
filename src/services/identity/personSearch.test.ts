import { describe, expect, it } from "vitest";
import { matchesPersonSearch, personSearchFilter, personSearchTerms } from "./personSearch";

describe("person search", () => {
  const fields = ["EMP-001", "Juan", "Santos", "Dela Cruz", null];

  it.each(["Dela Cruz, Juan", "Juan Dela Cruz", "  DELA  CRUZ,   JUAN ", "Juan Santos", "EMP-001"])("matches %s across name fields", (search) => {
    expect(matchesPersonSearch(personSearchTerms(search), fields)).toBe(true);
  });

  it("requires every term and handles empty searches", () => {
    expect(matchesPersonSearch(personSearchTerms("Dela Cruz, Pedro"), fields)).toBe(false);
    expect(matchesPersonSearch(personSearchTerms(" , "), fields)).toBe(true);
  });

  it("builds a grouped database filter for comma-separated names", () => {
    const filter = personSearchFilter("Dela Cruz, Juan", "employee_number");
    expect(filter).toBe('and(or(employee_number.ilike."%dela%",first_name.ilike."%dela%",middle_name.ilike."%dela%",last_name.ilike."%dela%",suffix.ilike."%dela%"),or(employee_number.ilike."%cruz%",first_name.ilike."%cruz%",middle_name.ilike."%cruz%",last_name.ilike."%cruz%",suffix.ilike."%cruz%"),or(employee_number.ilike."%juan%",first_name.ilike."%juan%",middle_name.ilike."%juan%",last_name.ilike."%juan%",suffix.ilike."%juan%"))');
    expect(personSearchFilter(" , ", "membership_number")).toBeNull();
  });

  it("quotes filter punctuation and escapes literal wildcard characters", () => {
    const search = 'O"Brien(100%_*)\\';
    const pattern = `%${search.toLowerCase().replace(/[\\%_*]/g, "\\$&")}%`;
    expect(personSearchFilter(search, "membership_number")).toContain(`last_name.ilike.${JSON.stringify(pattern)}`);
  });
});
