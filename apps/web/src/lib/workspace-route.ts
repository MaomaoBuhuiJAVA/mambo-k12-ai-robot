export type WorkspaceRouteOptions = {
  course?: string;
  tab?: string;
  work?: string;
  view?: string;
  hash?: string;
};

export function workspaceHref({ course, tab, work, view, hash }: WorkspaceRouteOptions = {}) {
  const params = new URLSearchParams();

  if (course) params.set("course", course);
  if (tab) params.set("tab", tab);
  if (work) params.set("work", work);
  if (view) params.set("view", view);

  const query = params.size > 0 ? `?${params.toString()}` : "";
  const fragment = hash ? `#${hash}` : "";
  return `/workspace${query}${fragment}`;
}
