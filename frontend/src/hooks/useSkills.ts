import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { WorkspaceSkillDefinitionRecord } from "@/types/repositories";

export type SkillWithContent = WorkspaceSkillDefinitionRecord & { content: string };

export type SkillsNavConfig = {
  /** Full path including workspace prefix (e.g. `/${workspaceId}/agent`). */
  path: string;
  fixedSearchParams: Record<string, string>;
};

function buildSkillsPath(config: SkillsNavConfig, target: { skillId?: string | null; mode?: string | null }): string {
  const p = new URLSearchParams(config.fixedSearchParams);
  if (target.skillId) p.set("skillId", target.skillId);
  else p.delete("skillId");
  if (target.mode) p.set("mode", target.mode);
  else p.delete("mode");
  const q = p.toString();
  return q ? `${config.path}?${q}` : config.path;
}

export function useSkills(navConfig: SkillsNavConfig) {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<WorkspaceSkillDefinitionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const fixedKey = JSON.stringify(navConfig.fixedSearchParams);

  const toSkillsUrl = useCallback(
    (target: { skillId?: string | null; mode?: string | null }) =>
      buildSkillsPath(
        { path: navConfig.path, fixedSearchParams: JSON.parse(fixedKey) as Record<string, string> },
        target,
      ),
    [navConfig.path, fixedKey],
  );

  const reload = useCallback(async () => {
    const res = await api.get<{ skills: WorkspaceSkillDefinitionRecord[] }>("/api/user/skills");
    setSkills(res.skills);
    setLoading(false);
    return res.skills;
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const fetchSkill = useCallback(async (id: string): Promise<SkillWithContent | null> => {
    try {
      const res = await api.get<{ skill: WorkspaceSkillDefinitionRecord; content: string | null }>(`/api/user/skills/${id}`);
      return { ...res.skill, content: res.content ?? "" };
    } catch {
      return null;
    }
  }, []);

  const createSkill = useCallback(
    async (displayName: string, description: string, content: string) => {
      const res = await api.post<{ skillId: string }>("/api/user/skills", { displayName, description, content });
      await reload();
      navigate(toSkillsUrl({ skillId: res.skillId }));
    },
    [reload, navigate, toSkillsUrl],
  );

  const updateSkill = useCallback(
    async (id: string, displayName: string, description: string, content: string, isActive: boolean) => {
      await api.put(`/api/user/skills/${id}`, { displayName, description, content, isActive });
      await reload();
      navigate(toSkillsUrl({ skillId: id }));
    },
    [reload, navigate, toSkillsUrl],
  );

  const deleteSkill = useCallback(
    async (id: string) => {
      await api.delete(`/api/user/skills/${id}`);
      const list = await reload();
      const next = list.find((s) => s.id !== id);
      navigate(next ? toSkillsUrl({ skillId: next.id }) : toSkillsUrl({ skillId: null }));
    },
    [reload, navigate, toSkillsUrl],
  );

  return { skills, loading, reload, fetchSkill, createSkill, updateSkill, deleteSkill, toSkillsUrl };
}
