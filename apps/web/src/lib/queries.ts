import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createApiClient } from "./api";
import { notify } from "./toast";
import type { Job, JobUpdate, ImportRequest } from "@whats-next/shared";

function useApi() {
  const { getToken } = useAuth();
  return useMemo(() => createApiClient({
    baseUrl: import.meta.env.VITE_API_URL as string, getToken: () => getToken(),
  }), [getToken]);
}

export function useJobs() {
  const api = useApi();
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => api.listJobs(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j: Job) => j.import_status === "importing") ? 2000 : false,
  });
}

export function useImportJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => api.importJob(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
    onError: () => notify.error("Couldn't reach the server"),
  });
}

export function useUpdateJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobUpdate }) => api.updateJob(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const prev = qc.getQueryData<Job[]>(["jobs"]);
      qc.setQueryData<Job[]>(["jobs"], (old) => (old ?? []).map((j) => (j.id === id ? { ...j, ...patch } : j)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["jobs"], ctx.prev);
      notify.error("Couldn't save changes");
    },
    onSuccess: (_data, { patch }) => {
      if (patch.stage) notify.moved(patch.stage);
      else notify.saved();
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useDeleteJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
    onError: () => notify.error("Couldn't delete the job"),
  });
}

export function useRestoreJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.restoreJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
    onError: () => notify.error("Couldn't restore the job"),
  });
}

export function useTokens() {
  const api = useApi();
  return useQuery({ queryKey: ["tokens"], queryFn: () => api.listTokens() });
}
export function useCreateToken() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.createToken(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
    onError: () => notify.error("Couldn't create token"),
  });
}
export function useRevokeToken() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteToken(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
    onError: () => notify.error("Couldn't revoke token"),
  });
}
