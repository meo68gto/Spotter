export const restFetchLocal = async <T>(path: string): Promise<T[]> => {
  const response = await fetch(`http://localhost:3000/api/db/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path })
  });

  if (!response.ok) {
    throw new Error(`Database query failed: ${path}`);
  }

  return (await response.json()) as T[];
};

export const invokeAdminFunctionLocal = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
  const response = await fetch(`http://localhost:3000/api/admin/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`Admin function failed: ${name}`);
  }
  
  return await response.json();
};
