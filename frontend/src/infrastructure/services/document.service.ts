import api from "../configs/axios.config";

export async function getDocumentViewerUrl(documentId: string) {
  const response = await api.get(`/documents/${documentId}/url`);
  return response.data;
}

export async function deleteDocument(documentId: string) {
  await api.delete(`/documents/${documentId}`);
}
