import type { Problem, InterviewType, Difficulty } from "./types";
import problemsData from "./problems.json";

const problems = problemsData as Problem[];

export function getAllProblems(): Problem[] {
  return problems;
}

export function getProblemsByType(type: InterviewType): Problem[] {
  return problems.filter((p) => p.type === type);
}

export function getProblemById(id: string): Problem | undefined {
  return problems.find((p) => p.id === id);
}

export function filterProblems({
  type,
  difficulty,
  company,
  query,
}: {
  type?: InterviewType;
  difficulty?: Difficulty;
  company?: string;
  query?: string;
}): Problem[] {
  return problems.filter((p) => {
    if (type && p.type !== type) return false;
    if (difficulty && p.difficulty !== difficulty) return false;
    if (company && !p.companies.includes(company)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (
        !p.title.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });
}

export function getAllCompanies(): string[] {
  const set = new Set<string>();
  problems.forEach((p) => p.companies.forEach((c) => set.add(c)));
  return Array.from(set).sort();
}
