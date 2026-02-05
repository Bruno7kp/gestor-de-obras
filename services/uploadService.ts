const API_BASE = (import.meta as any).env?.VITE_API_URL ?? '/api';

type UploadResponse = {
  url: string;
  filename?: string;
  size?: number;
  mimeType?: string;
};

export const uploadService = {
  async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return response.json();
  },
};
