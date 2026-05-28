import { useAuth } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { createApiClient } from "./api";
import type { Job, JobUpdate, ImportRequest } from "@seeking/shared";

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
    // poll while anything is still importing
    refetchInterval: (query) =>
      (query.state.data ?? []).some((j: Job) => j.import_status === "importing") ? 2000 : false,
  });
}

export function useImportJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportRequest) => api.importJob(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobUpdate }) => api.updateJob(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useDeleteJob() {
  const api = useApi(); const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteJob(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
